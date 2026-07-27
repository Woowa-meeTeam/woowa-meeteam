const fabricTextureUrl = new URL("./assets/hero-fabric.webp", import.meta.url).href

const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

const fragmentShaderSource = `
  precision highp float;

  uniform sampler2D u_texture;
  uniform vec2 u_resolution;
  uniform vec2 u_texture_size;
  uniform float u_time;
  varying vec2 v_uv;

  vec2 coverUv(vec2 uv) {
    float viewportAspect = u_resolution.x / u_resolution.y;
    float textureAspect = u_texture_size.x / u_texture_size.y;

    if (viewportAspect > textureAspect) {
      uv.y = (uv.y - 0.5) * textureAspect / viewportAspect + 0.5;
    } else {
      uv.x = (uv.x - 0.5) * viewportAspect / textureAspect + 0.5;
    }

    return uv;
  }

  void main() {
    vec2 uv = coverUv(v_uv);
    float slowTime = u_time * 0.22;
    float centerWeight = exp(-pow((uv.y - 0.5) * 3.1, 2.0));

    float broadFold = sin(uv.y * 4.8 + slowTime) * 0.030;
    float fineFold = sin(uv.y * 11.5 - slowTime * 0.72) * 0.010;
    float centerTwist = sin(uv.y * 7.0 + slowTime * 1.18) * 0.026 * centerWeight;
    float verticalDrift = sin(uv.x * 5.4 - slowTime * 0.86) * (0.010 + centerWeight * 0.012);

    vec2 warpedUv = uv;
    warpedUv.x += broadFold + fineFold + centerTwist;
    warpedUv.y += verticalDrift;

    vec4 color = texture2D(u_texture, warpedUv);
    float movingLight = 0.91 + sin(slowTime * 1.35 + warpedUv.y * 5.2) * 0.09;
    float highlight = 1.0 + centerWeight * (0.03 + sin(slowTime * 0.9) * 0.025);
    color.rgb *= movingLight * highlight;

    gl_FragColor = color;
  }
`

type FabricUniforms = {
  readonly resolution: WebGLUniformLocation
  readonly textureSize: WebGLUniformLocation
  readonly time: WebGLUniformLocation
}

function createShader(
  context: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = context.createShader(type)
  if (shader === null) {
    return null
  }

  context.shaderSource(shader, source)
  context.compileShader(shader)

  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    context.deleteShader(shader)
    return null
  }

  return shader
}

function createProgram(context: WebGLRenderingContext): WebGLProgram | null {
  const vertexShader = createShader(context, context.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = createShader(context, context.FRAGMENT_SHADER, fragmentShaderSource)
  if (vertexShader === null || fragmentShader === null) {
    return null
  }

  const program = context.createProgram()
  if (program === null) {
    return null
  }

  context.attachShader(program, vertexShader)
  context.attachShader(program, fragmentShader)
  context.linkProgram(program)
  context.deleteShader(vertexShader)
  context.deleteShader(fragmentShader)

  if (!context.getProgramParameter(program, context.LINK_STATUS)) {
    context.deleteProgram(program)
    return null
  }

  return program
}

function getUniforms(context: WebGLRenderingContext, program: WebGLProgram): FabricUniforms | null {
  const resolution = context.getUniformLocation(program, "u_resolution")
  const textureSize = context.getUniformLocation(program, "u_texture_size")
  const time = context.getUniformLocation(program, "u_time")

  if (resolution === null || textureSize === null || time === null) {
    return null
  }

  return { resolution, textureSize, time }
}

function resizeCanvas(canvas: HTMLCanvasElement, context: WebGLRenderingContext): void {
  const pixelRatio = Math.min(window.devicePixelRatio, 2)
  const width = Math.round(canvas.clientWidth * pixelRatio)
  const height = Math.round(canvas.clientHeight * pixelRatio)

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
    context.viewport(0, 0, width, height)
  }
}

function configureGeometry(context: WebGLRenderingContext, program: WebGLProgram): boolean {
  const position = context.getAttribLocation(program, "a_position")
  const buffer = context.createBuffer()
  if (position < 0 || buffer === null) {
    return false
  }

  context.bindBuffer(context.ARRAY_BUFFER, buffer)
  context.bufferData(
    context.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    context.STATIC_DRAW,
  )
  context.enableVertexAttribArray(position)
  context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0)
  return true
}

function configureTexture(context: WebGLRenderingContext, image: HTMLImageElement): boolean {
  const texture = context.createTexture()
  if (texture === null) {
    return false
  }

  context.bindTexture(context.TEXTURE_2D, texture)
  context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, 1)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR)
  context.texImage2D(
    context.TEXTURE_2D,
    0,
    context.RGBA,
    context.RGBA,
    context.UNSIGNED_BYTE,
    image,
  )
  return true
}

function runRenderer(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  reducedMotion: boolean,
): void {
  const context = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    powerPreference: "high-performance",
  })
  if (context === null) {
    return
  }

  const program = createProgram(context)
  if (
    program === null ||
    !configureGeometry(context, program) ||
    !configureTexture(context, image)
  ) {
    return
  }

  const uniforms = getUniforms(context, program)
  if (uniforms === null) {
    return
  }

  context.useProgram(program)
  context.clearColor(0, 0, 0, 1)
  canvas.setAttribute("data-ready", "true")

  const render = (timestamp: number): void => {
    resizeCanvas(canvas, context)
    context.uniform2f(uniforms.resolution, canvas.width, canvas.height)
    context.uniform2f(uniforms.textureSize, image.naturalWidth, image.naturalHeight)
    context.uniform1f(uniforms.time, reducedMotion ? 7.5 : timestamp * 0.001)
    context.drawArrays(context.TRIANGLES, 0, 6)

    if (!reducedMotion) {
      window.requestAnimationFrame(render)
    }
  }

  window.requestAnimationFrame(render)
}

export function startFabricRenderer(canvas: HTMLCanvasElement, reducedMotion: boolean): void {
  const image = new Image()
  image.decoding = "async"
  image.addEventListener("load", () => {
    runRenderer(canvas, image, reducedMotion)
  })
  image.src = fabricTextureUrl
}

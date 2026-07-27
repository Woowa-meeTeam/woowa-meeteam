import { motion } from 'motion/react';

const skills = ['React', 'TypeScript', 'Spring', 'Kotlin', 'Android', 'Swift', 'Figma', 'MySQL'];

export default function SkillCloud() {
  return (
    <section className="relative z-20 max-w-6xl mx-auto px-6 py-16 md:py-24">
      <p className="text-center text-xs uppercase tracking-widest text-white/60">
        온보딩에서 고른 스킬로 서로를 알아봐요
      </p>
      <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-6">
        {skills.map((name, i) => (
          <motion.div
            key={name}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="text-center text-sm font-semibold tracking-tight text-white/70 hover:text-white transition-colors"
          >
            {name}
          </motion.div>
        ))}
      </div>
    </section>
  );
}

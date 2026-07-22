import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Supabase 로 직접 통신하므로 API 프록시가 필요 없습니다.
export default defineConfig({
  plugins: [react()],
});

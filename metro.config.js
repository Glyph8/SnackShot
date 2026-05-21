// Metro bundler 설정 — '@/*' alias를 런타임에 해석시킴.
// tsconfig의 paths는 TypeScript 컴파일러용이고, 
// 실제 앱 실행 시엔 Metro가 별도로 알아들어야 함.

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.alias = {
  '@': path.resolve(__dirname, 'src'),
};

module.exports = config;

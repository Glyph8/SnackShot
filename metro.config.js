// Metro bundler 설정 — '@/*' alias를 런타임에 해석시킴.
// tsconfig의 paths는 TypeScript 컴파일러용이고, 
// 실제 앱 실행 시엔 Metro가 별도로 알아들어야 함.

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.alias = {
  '@': path.resolve(__dirname, 'src'),
};

// react-native-calendars@1.1314.0 패키징 버그 우회:
// package.json의 main이 src/index.ts(TypeScript 소스)를 가리키지만,
// 하위 모듈들은 .js만 존재해서 Metro가 resolve 실패.
// 컴파일된 src/index.js로 리다이렉트한다.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-calendars') {
    return context.resolveRequest(
      context,
      require.resolve('react-native-calendars/src/index.js'),
      platform,
    );
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

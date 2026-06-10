'use strict';
/**
 * Expo Config Plugin — SnackShot 홈 화면 위젯
 *
 * expo prebuild (--clean 포함) 이후에도 위젯 파일을 자동 복원한다.
 * 소스: plugins/widget/  →  android/app/src/main/...
 */
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const WIDGET_PKG = 'com.glyph8.snackshot';
const PLUGIN_DIR = path.join(__dirname, 'widget');

/** 디렉토리를 생성하면서 파일을 복사한다. */
function copyFile(src, dest) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, dest);
}

/**
 * XML colors 파일에 색상 항목을 추가한다.
 * 이미 존재하는 항목은 건너뛴다. <resources/> 자기 닫힘 태그도 처리한다.
 */
function patchColorsXml(filePath, colors) {
  let xml;
  if (fs.existsSync(filePath)) {
    xml = fs.readFileSync(filePath, 'utf8').trim();
    // <resources/> 자기 닫힘 처리
    if (/^<resources\s*\/>$/.test(xml)) {
      xml = '<resources>';
    } else {
      xml = xml.replace(/<\/resources>\s*$/, '');
    }
  } else {
    xml = '<resources>';
  }

  for (const { name, value } of colors) {
    if (!xml.includes(`name="${name}"`)) {
      xml += `\n  <color name="${name}">${value}</color>`;
    }
  }

  xml += '\n</resources>\n';

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, xml, 'utf8');
}

/** 위젯 리소스 파일 + Kotlin 소스를 android/ 에 복사한다. */
const withWidgetFiles = (config) =>
  withDangerousMod(config, [
    'android',
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const resDir = path.join(projectRoot, 'android/app/src/main/res');
      const javaDir = path.join(
        projectRoot,
        'android/app/src/main/java',
        ...WIDGET_PKG.split('.')
      );

      // 리소스 파일 복사
      copyFile(
        path.join(PLUGIN_DIR, 'res/drawable/widget_record_btn.xml'),
        path.join(resDir, 'drawable/widget_record_btn.xml')
      );
      copyFile(
        path.join(PLUGIN_DIR, 'res/drawable/widget_background.xml'),
        path.join(resDir, 'drawable/widget_background.xml')
      );
      copyFile(
        path.join(PLUGIN_DIR, 'res/layout/snackshot_widget.xml'),
        path.join(resDir, 'layout/snackshot_widget.xml')
      );
      copyFile(
        path.join(PLUGIN_DIR, 'res/xml/snackshot_widget_info.xml'),
        path.join(resDir, 'xml/snackshot_widget_info.xml')
      );
      copyFile(
        path.join(PLUGIN_DIR, 'java/SnackShotWidget.kt'),
        path.join(javaDir, 'SnackShotWidget.kt')
      );

      // 색상 패치 — 라이트
      patchColorsXml(path.join(resDir, 'values/colors.xml'), [
        { name: 'widget_background', value: '#FFFFFF' },
        { name: 'widget_text',       value: '#1C1C1E' },
        { name: 'widget_btn',        value: '#E53935' },
      ]);

      // 색상 패치 — 다크
      patchColorsXml(path.join(resDir, 'values-night/colors.xml'), [
        { name: 'widget_background', value: '#1C1C1E' },
        { name: 'widget_text',       value: '#F2F2F7' },
        { name: 'widget_btn',        value: '#E53935' },
      ]);

      return config;
    },
  ]);

/** AndroidManifest.xml에 AppWidgetProvider receiver를 추가한다. */
const withWidgetManifest = (config) =>
  withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];
    if (!app.receiver) app.receiver = [];

    const alreadyRegistered = app.receiver.some(
      (r) => r.$?.['android:name'] === '.SnackShotWidget'
    );
    if (alreadyRegistered) return config;

    app.receiver.push({
      $: {
        'android:name': '.SnackShotWidget',
        'android:exported': 'true',
      },
      'intent-filter': [
        {
          action: [
            { $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } },
          ],
        },
      ],
      'meta-data': [
        {
          $: {
            'android:name': 'android.appwidget.provider',
            'android:resource': '@xml/snackshot_widget_info',
          },
        },
      ],
    });

    return config;
  });

const withSnackShotWidget = (config) => {
  config = withWidgetFiles(config);
  config = withWidgetManifest(config);
  return config;
};

module.exports = withSnackShotWidget;

/// <reference types="node" />
/**
 * Expo Config Plugin — SnackShot 홈 화면 위젯
 *
 * expo prebuild (--clean 포함) 이후에도 위젯 파일을 자동 복원한다.
 *
 * 소스:  plugins/widget/  →  android/app/src/main/…
 * 출력:  plugins/with-snackshot-widget.js  (tsc 컴파일 산출물, Expo가 실제 로드)
 *
 * 컴파일:  cd plugins && npx tsc -p tsconfig.json
 */

import type { ExpoConfig } from '@expo/config-types';
import { withAndroidManifest, withDangerousMod } from '@expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';

// ── 상수 ─────────────────────────────────────────────────────────────────────

const WIDGET_PKG = 'com.glyph8.snackshot';
const PLUGIN_DIR = path.join(__dirname, 'widget');

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function copyFile(src: string, dest: string): void {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, dest);
}

interface ColorEntry {
  name: string;
  value: string;
}

/**
 * colors.xml 파일에 색상 항목을 추가한다.
 * 이미 존재하는 항목은 건너뛴다. `<resources/>` 자기 닫힘 형식도 처리한다.
 */
function patchColorsXml(filePath: string, colors: ColorEntry[]): void {
  let xml: string;
  if (fs.existsSync(filePath)) {
    xml = fs.readFileSync(filePath, 'utf8').trim();
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

// ── Mod: 리소스 파일 + Kotlin 소스 복사 ──────────────────────────────────────

function withWidgetFiles(config: ExpoConfig): ExpoConfig {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const root = cfg.modRequest.projectRoot;
      const resDir = path.join(root, 'android/app/src/main/res');
      const javaDir = path.join(
        root,
        'android/app/src/main/java',
        ...WIDGET_PKG.split('.'),
      );

      // 리소스 파일 복사
      copyFile(
        path.join(PLUGIN_DIR, 'res/drawable/widget_record_btn.xml'),
        path.join(resDir, 'drawable/widget_record_btn.xml'),
      );
      copyFile(
        path.join(PLUGIN_DIR, 'res/drawable/widget_background.xml'),
        path.join(resDir, 'drawable/widget_background.xml'),
      );
      copyFile(
        path.join(PLUGIN_DIR, 'res/layout/snackshot_widget.xml'),
        path.join(resDir, 'layout/snackshot_widget.xml'),
      );
      copyFile(
        path.join(PLUGIN_DIR, 'res/xml/snackshot_widget_info.xml'),
        path.join(resDir, 'xml/snackshot_widget_info.xml'),
      );
      copyFile(
        path.join(PLUGIN_DIR, 'java/SnackShotWidget.kt'),
        path.join(javaDir, 'SnackShotWidget.kt'),
      );

      // 색상 패치 — 라이트 테마
      patchColorsXml(path.join(resDir, 'values/colors.xml'), [
        { name: 'widget_background', value: '#FFFFFF' },
        { name: 'widget_text',       value: '#1C1C1E' },
        { name: 'widget_btn',        value: '#E53935' },
      ]);

      // 색상 패치 — 다크 테마
      patchColorsXml(path.join(resDir, 'values-night/colors.xml'), [
        { name: 'widget_background', value: '#1C1C1E' },
        { name: 'widget_text',       value: '#F2F2F7' },
        { name: 'widget_btn',        value: '#E53935' },
      ]);

      return cfg;
    },
  ]);
}

// ── Mod: AndroidManifest.xml에 AppWidgetProvider receiver 추가 ───────────────

function withWidgetManifest(config: ExpoConfig): ExpoConfig {
  return withAndroidManifest(config, (cfg) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = cfg.modResults.manifest.application?.[0] as any;
    if (!app.receiver) app.receiver = [];

    const alreadyRegistered = (app.receiver as Array<{ $?: { 'android:name'?: string } }>).some(
      (r) => r.$?.['android:name'] === '.SnackShotWidget',
    );
    if (alreadyRegistered) return cfg;

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

    return cfg;
  });
}

// ── 플러그인 엔트리포인트 ──────────────────────────────────────────────────────

function withSnackShotWidget(config: ExpoConfig): ExpoConfig {
  config = withWidgetFiles(config);
  config = withWidgetManifest(config);
  return config;
}

module.exports = withSnackShotWidget;

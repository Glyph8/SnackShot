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
        path.join(PLUGIN_DIR, 'res/drawable/widget_btn_primary.xml'),
        path.join(resDir, 'drawable/widget_btn_primary.xml'),
      );
      copyFile(
        path.join(PLUGIN_DIR, 'res/drawable/widget_btn_secondary.xml'),
        path.join(resDir, 'drawable/widget_btn_secondary.xml'),
      );
      copyFile(
        path.join(PLUGIN_DIR, 'res/drawable/widget_tape.xml'),
        path.join(resDir, 'drawable/widget_tape.xml'),
      );
      copyFile(
        path.join(PLUGIN_DIR, 'res/drawable/ic_widget_video.xml'),
        path.join(resDir, 'drawable/ic_widget_video.xml'),
      );
      copyFile(
        path.join(PLUGIN_DIR, 'res/drawable/ic_widget_mic.xml'),
        path.join(resDir, 'drawable/ic_widget_mic.xml'),
      );
      copyFile(
        path.join(PLUGIN_DIR, 'res/drawable/ic_widget_pencil.xml'),
        path.join(resDir, 'drawable/ic_widget_pencil.xml'),
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
      copyFile(
        path.join(PLUGIN_DIR, 'java/SnackShotTiles.kt'),
        path.join(javaDir, 'SnackShotTiles.kt'),
      );

      // 색상 패치 — 라이트(페이퍼) 테마
      patchColorsXml(path.join(resDir, 'values/colors.xml'), [
        { name: 'widget_background', value: '#F4EEDD' }, // 종이 카드
        { name: 'widget_text',       value: '#2C2823' }, // 잉크
        { name: 'widget_meta',       value: '#8A8478' }, // 날짜·개수
        { name: 'widget_btn',        value: '#B5502D' }, // 영상(primary)
        { name: 'widget_on_primary', value: '#FDF8EC' }, // primary 위 텍스트
        { name: 'widget_secondary',  value: '#FCFAF4' }, // 음성/직접쓰기 버튼
        { name: 'widget_tape',       value: '#C7BBA0' }, // 마스킹 테이프
      ]);

      // 색상 패치 — 다크 테마
      patchColorsXml(path.join(resDir, 'values-night/colors.xml'), [
        { name: 'widget_background', value: '#2A2722' },
        { name: 'widget_text',       value: '#F2ECDA' },
        { name: 'widget_meta',       value: '#B8B0A0' },
        { name: 'widget_btn',        value: '#B5502D' },
        { name: 'widget_on_primary', value: '#FDF8EC' },
        { name: 'widget_secondary',  value: '#3A352E' },
        { name: 'widget_tape',       value: '#5A5346' },
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

// ── Mod: AndroidManifest.xml에 빠른 설정 타일 service 추가 ───────────────────

function withTilesManifest(config: ExpoConfig): ExpoConfig {
  return withAndroidManifest(config, (cfg) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = cfg.modResults.manifest.application?.[0] as any;
    if (!app.service) app.service = [];

    const tiles: Array<{ name: string; label: string; icon: string }> = [
      { name: '.RecordVideoTileService', label: '영상 녹화', icon: '@drawable/ic_widget_video' },
      { name: '.RecordAudioTileService', label: '음성 녹음', icon: '@drawable/ic_widget_mic' },
    ];

    for (const tile of tiles) {
      const exists = (app.service as Array<{ $?: { 'android:name'?: string } }>).some(
        (s) => s.$?.['android:name'] === tile.name,
      );
      if (exists) continue;
      app.service.push({
        $: {
          'android:name': tile.name,
          'android:exported': 'true',
          'android:icon': tile.icon,
          'android:label': tile.label,
          'android:permission': 'android.permission.BIND_QUICK_SETTINGS_TILE',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.service.quicksettings.action.QS_TILE' } },
            ],
          },
        ],
      });
    }

    return cfg;
  });
}

// ── 플러그인 엔트리포인트 ──────────────────────────────────────────────────────

function withSnackShotWidget(config: ExpoConfig): ExpoConfig {
  config = withWidgetFiles(config);
  config = withWidgetManifest(config);
  config = withTilesManifest(config);
  return config;
}

module.exports = withSnackShotWidget;

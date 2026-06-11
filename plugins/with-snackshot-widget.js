"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const config_plugins_1 = require("@expo/config-plugins");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// ── 상수 ─────────────────────────────────────────────────────────────────────
const WIDGET_PKG = 'com.glyph8.snackshot';
const PLUGIN_DIR = path.join(__dirname, 'widget');
// ── 헬퍼 ─────────────────────────────────────────────────────────────────────
function copyFile(src, dest) {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(src, dest);
}
/**
 * colors.xml 파일에 색상 항목을 추가한다.
 * 이미 존재하는 항목은 건너뛴다. `<resources/>` 자기 닫힘 형식도 처리한다.
 */
function patchColorsXml(filePath, colors) {
    let xml;
    if (fs.existsSync(filePath)) {
        xml = fs.readFileSync(filePath, 'utf8').trim();
        if (/^<resources\s*\/>$/.test(xml)) {
            xml = '<resources>';
        }
        else {
            xml = xml.replace(/<\/resources>\s*$/, '');
        }
    }
    else {
        xml = '<resources>';
    }
    for (const { name, value } of colors) {
        if (!xml.includes(`name="${name}"`)) {
            xml += `\n  <color name="${name}">${value}</color>`;
        }
    }
    xml += '\n</resources>\n';
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, xml, 'utf8');
}
// ── Mod: 리소스 파일 + Kotlin 소스 복사 ──────────────────────────────────────
function withWidgetFiles(config) {
    return (0, config_plugins_1.withDangerousMod)(config, [
        'android',
        (cfg) => {
            const root = cfg.modRequest.projectRoot;
            const resDir = path.join(root, 'android/app/src/main/res');
            const javaDir = path.join(root, 'android/app/src/main/java', ...WIDGET_PKG.split('.'));
            // 리소스 파일 복사
            copyFile(path.join(PLUGIN_DIR, 'res/drawable/widget_record_btn.xml'), path.join(resDir, 'drawable/widget_record_btn.xml'));
            copyFile(path.join(PLUGIN_DIR, 'res/drawable/widget_background.xml'), path.join(resDir, 'drawable/widget_background.xml'));
            copyFile(path.join(PLUGIN_DIR, 'res/layout/snackshot_widget.xml'), path.join(resDir, 'layout/snackshot_widget.xml'));
            copyFile(path.join(PLUGIN_DIR, 'res/xml/snackshot_widget_info.xml'), path.join(resDir, 'xml/snackshot_widget_info.xml'));
            copyFile(path.join(PLUGIN_DIR, 'java/SnackShotWidget.kt'), path.join(javaDir, 'SnackShotWidget.kt'));
            // 색상 패치 — 라이트 테마
            patchColorsXml(path.join(resDir, 'values/colors.xml'), [
                { name: 'widget_background', value: '#FFFFFF' },
                { name: 'widget_text', value: '#1C1C1E' },
                { name: 'widget_btn', value: '#E53935' },
            ]);
            // 색상 패치 — 다크 테마
            patchColorsXml(path.join(resDir, 'values-night/colors.xml'), [
                { name: 'widget_background', value: '#1C1C1E' },
                { name: 'widget_text', value: '#F2F2F7' },
                { name: 'widget_btn', value: '#E53935' },
            ]);
            return cfg;
        },
    ]);
}
// ── Mod: AndroidManifest.xml에 AppWidgetProvider receiver 추가 ───────────────
function withWidgetManifest(config) {
    return (0, config_plugins_1.withAndroidManifest)(config, (cfg) => {
        var _a;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const app = (_a = cfg.modResults.manifest.application) === null || _a === void 0 ? void 0 : _a[0];
        if (!app.receiver)
            app.receiver = [];
        const alreadyRegistered = app.receiver.some((r) => { var _a; return ((_a = r.$) === null || _a === void 0 ? void 0 : _a['android:name']) === '.SnackShotWidget'; });
        if (alreadyRegistered)
            return cfg;
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
function withSnackShotWidget(config) {
    config = withWidgetFiles(config);
    config = withWidgetManifest(config);
    return config;
}
module.exports = withSnackShotWidget;

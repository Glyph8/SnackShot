// 마이그레이션 결정성 + append-only 가드 (INV-migration-append).
//
// schema.ts는 외부 import가 없으므로 단독 컴파일해 MIGRATIONS 객체를 실제로 평가한다.
// 검사 항목:
//   1) 구조: TARGET_VERSION == 최대 버전 키, 1..max 버전 누락 없음, 모든 statement는 string
//   2) append-only: scripts/migrations.lock.json에 잠긴 "기존 버전"의 SQL 해시가 바뀌면 실패.
//      (새 버전 추가는 허용 — 잠금에 없으므로 통과. 추가 후 `--update`로 잠금 갱신.)
//
// 사용:
//   node scripts/check-migrations.mjs            # 검사
//   node scripts/check-migrations.mjs --update   # 현재 상태로 잠금 파일 갱신(새 마이그레이션 추가 시)

import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lockPath = join(root, 'scripts', 'migrations.lock.json');
const update = process.argv.includes('--update');

const out = mkdtempSync(join(tmpdir(), 'snapmig-'));
execSync(
  `npx tsc src/db/schema.ts --outDir "${out}" --module commonjs --target es2019 --rootDir src/db --skipLibCheck`,
  { cwd: root, stdio: 'inherit' },
);

const require = createRequire(import.meta.url);
const { MIGRATIONS, TARGET_VERSION } = require(join(out, 'schema.js'));

const versions = Object.keys(MIGRATIONS).map(Number).sort((a, b) => a - b);
const max = Math.max(...versions);
const errs = [];

if (max !== TARGET_VERSION) {
  errs.push(`TARGET_VERSION(${TARGET_VERSION}) != 최대 마이그레이션 키(${max})`);
}
for (let v = 1; v <= max; v++) {
  if (!MIGRATIONS[v]) errs.push(`마이그레이션 버전 ${v} 누락(연속이어야 함)`);
}
for (const v of versions) {
  for (const s of MIGRATIONS[v]) {
    if (typeof s !== 'string') errs.push(`v${v}에 string이 아닌 statement 존재`);
  }
}

const hashes = {};
for (const v of versions) {
  hashes[v] = createHash('sha256').update(JSON.stringify(MIGRATIONS[v])).digest('hex');
}

if (update || !existsSync(lockPath)) {
  writeFileSync(lockPath, JSON.stringify(hashes, null, 2) + '\n');
  console.log(`migrations.lock.json ${update ? '갱신' : '생성'}됨 (${versions.length} versions)`);
} else {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  for (const v of Object.keys(lock)) {
    if (hashes[v] !== lock[v]) {
      errs.push(
        `버전 ${v}의 SQL이 변경됨 — 기존 마이그레이션 수정 금지(INV-migration-append). ` +
          `새 버전을 추가하고 'node scripts/check-migrations.mjs --update'로 잠금을 갱신하라.`,
      );
    }
  }
  for (const v of versions) {
    if (!(String(v) in lock)) {
      console.log(`(신규) 버전 ${v}이 잠금에 없음 — 새 마이그레이션이면 --update로 잠금 갱신`);
    }
  }
}

if (errs.length) {
  console.error('✗ 마이그레이션 검사 실패:');
  for (const e of errs) console.error('  - ' + e);
  process.exit(1);
}
console.log(`✓ 마이그레이션 OK (append-only 유지, ${versions.length} versions, target v${TARGET_VERSION})`);

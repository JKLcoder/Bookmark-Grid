"""Package verified build output; never modify the source key or dist manifest."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json

root = Path(__file__).resolve().parent.parent
files = sorted(p for p in (root / 'dist').rglob('*') if p.is_file())
manifest = json.loads((root / 'dist/manifest.json').read_text())
assert manifest['key'] == json.loads((root / 'public/manifest.json').read_text())['key']
public_key = __import__('base64').b64decode(manifest['key'], validate=True)
identity = ''.join(chr(97 + int(c, 16)) for c in hashlib.sha256(public_key).hexdigest()[:32])
assert identity == 'hakccklcdnjclaboolbceiebhaigebpo'
notes = (root / 'docs/settings-sync.md').read_text()
for migration, filename in [(False, 'bookmark-grid-dist.zip'), (True, 'bookmark-grid-migration.zip')]:
    expected = {}
    for path in files:
        name = path.relative_to(root).as_posix()
        data = path.read_bytes()
        if migration and name == 'dist/manifest.json':
            alternate = dict(manifest)
            del alternate['key']
            alternate['name'] = 'Bookmark Grid（迁移过渡包）'
            data = (json.dumps(alternate, ensure_ascii=False, indent=2) + '\n').encode()
        expected[name] = data
    expected['升级说明.txt'] = notes.encode()
    target = root / 'downloads' / filename
    with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
        for name, data in expected.items():
            archive.writestr(name, data)
    with ZipFile(target) as archive:
        assert archive.testzip() is None
        assert set(archive.namelist()) == set(expected)
        for name, data in expected.items():
            assert archive.read(name) == data
        actual = json.loads(archive.read('dist/manifest.json'))
        assert ('key' not in actual) if migration else (actual['key'] == manifest['key'])
    print(f'PASS: {filename}: {len(expected)} files, migration={migration}')
print(f'Fixed unpacked extension ID: {identity}')

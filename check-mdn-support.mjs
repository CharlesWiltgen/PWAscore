import bcd from '@mdn/browser-compat-data' with { type: 'json' };

const paths = [
  'manifests.webapp.name',
  'api.PublicKeyCredential',
  'api.URL.createObjectURL_static',
  'webassembly.api',
  'webassembly.api.instantiate_static',
  'api.isSecureContext'
];

function navigatePath(data, path) {
  const parts = path.split('.');
  let current = data;
  for (const part of parts) {
    current = current?.[part];
    if (!current) return null;
  }
  return current;
}

function checkSupport(feature, currentVersion) {
  const safari = feature.__compat?.support?.safari_ios;
  if (!safari) return { level: 'NO_DATA', partial: false };

  const data = Array.isArray(safari) ? safari[0] : safari;

  // Check for flags
  if (data.flags?.length > 0) return { level: 'BEHIND_FLAG', partial: false };

  // Check version_added
  if (data.version_added === false) return { level: 'NOT_SUPPORTED', partial: false };
  if (data.version_added === true) return { level: 'SUPPORTED', partial: data.partial_implementation || false };
  if (data.version_added === null) return { level: 'UNKNOWN', partial: false };

  // Compare versions
  const requiredVersion = String(data.version_added);
  const current = parseFloat(currentVersion);
  const required = parseFloat(requiredVersion);

  if (current >= required) {
    return { level: 'SUPPORTED', partial: data.partial_implementation || false };
  } else {
    return { level: 'NOT_SUPPORTED', partial: false };
  }
}

console.log('Safari iOS 18.4 support check:\n');

for (const path of paths) {
  const feature = navigatePath(bcd, path);
  if (!feature) {
    console.log(`${path}: PATH_NOT_FOUND`);
    continue;
  }

  const support = checkSupport(feature, '18.4');
  const finalLevel = support.partial ? 'PARTIAL' : support.level;

  console.log(`${path}:`);
  console.log(`  Support level: ${finalLevel}`);
  if (support.partial) {
    console.log(`  (partial_implementation: true)`);
  }

  // Show raw data
  const safari = feature.__compat?.support?.safari_ios;
  if (safari) {
    const data = Array.isArray(safari) ? safari[0] : safari;
    console.log(`  Raw: version_added=${JSON.stringify(data.version_added)}, partial_implementation=${data.partial_implementation || false}`);
  }
  console.log('');
}

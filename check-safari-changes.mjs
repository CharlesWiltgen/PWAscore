import bcd from '@mdn/browser-compat-data' with { type: 'json' }

const paths = [
  {
    old: 'html.manifest',
    new: 'manifests.webapp.name',
    feature: 'Web App Manifest'
  },
  {
    old: 'api.Web_Authentication_API',
    new: 'api.PublicKeyCredential',
    feature: 'WebAuthn'
  },
  {
    old: 'api.URL.createObjectURL',
    new: 'api.URL.createObjectURL_static',
    feature: 'Blob URLs'
  },
  {
    old: 'javascript.builtins.WebAssembly',
    new: 'webassembly.api',
    feature: 'WebAssembly'
  },
  {
    old: 'javascript.builtins.WebAssembly.instantiate',
    new: 'webassembly.api.instantiate_static',
    feature: 'WASM instantiate'
  },
  {
    old: 'api.Window.isSecureContext',
    new: 'api.isSecureContext',
    feature: 'isSecureContext'
  }
]

function getSupport(path) {
  const parts = path.split('.')
  let current = bcd
  for (const part of parts) {
    current = current?.[part]
    if (!current) return 'PATH_NOT_FOUND'
  }

  const safari = current.__compat?.support?.safari_ios
  if (!safari) return 'NO_SAFARI_DATA'

  const data = Array.isArray(safari) ? safari[0] : safari
  if (data.version_added === false) return 'NOT_SUPPORTED'
  if (data.version_added === true) return 'SUPPORTED'
  if (data.version_added === null) return 'UNKNOWN'
  if (data.flags?.length > 0) return 'BEHIND_FLAG'
  return data.version_added || 'UNKNOWN'
}

console.log('Checking Safari iOS support changes:\n')
paths.forEach((p) => {
  const oldSupport = getSupport(p.old)
  const newSupport = getSupport(p.new)
  if (oldSupport !== newSupport) {
    console.log(`${p.feature}:`)
    console.log(`  Old path (${p.old}): ${oldSupport}`)
    console.log(`  New path (${p.new}): ${newSupport}`)
    console.log('')
  }
})

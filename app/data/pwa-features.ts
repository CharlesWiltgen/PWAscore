/**
 * Comprehensive hierarchical list of PWA features
 * Inspired by whatpwacando.today and other PWA resources
 */

export interface PWAFeature {
  id: string
  name: string
  description: string
  apiName?: string
  specification?: string
  canIUseId?: string
}

export interface PWAFeatureCategory {
  id: string
  name: string
  description: string
  features: PWAFeature[]
}

export interface PWAFeatureGroup {
  id: string
  name: string
  description: string
  icon?: string
  categories: PWAFeatureCategory[]
}

export const pwaFeatures: PWAFeatureGroup[] = [
  {
    id: 'installation-core',
    name: 'Installation & Core PWA Features',
    description:
      'Fundamental PWA capabilities including installation, service workers, and offline support',
    icon: 'i-heroicons-arrow-down-tray',
    categories: [
      {
        id: 'app-installation',
        name: 'App Installation',
        description: 'Features related to installing PWAs on devices',
        features: [
          {
            id: 'beforeinstallprompt',
            name: 'beforeinstallprompt API',
            description: 'Prompt users to install the PWA',
            apiName: 'beforeinstallprompt',
            canIUseId: 'web-app-manifest'
          },
          {
            id: 'add-to-home-screen',
            name: 'Add to Home Screen',
            description: 'Add app icon to device home screen',
            apiName: 'Add to Home Screen',
            canIUseId: 'web-app-manifest'
          },
          {
            id: 'web-app-manifest',
            name: 'Web App Manifest',
            description: 'JSON file describing app metadata and behavior',
            apiName: 'Manifest',
            canIUseId: 'web-app-manifest'
          },
          {
            id: 'display-modes',
            name: 'Display Modes',
            description:
              'Control how the app is displayed (standalone, fullscreen, minimal-ui, browser)',
            apiName: 'display',
            canIUseId: 'web-app-manifest'
          },
          {
            id: 'app-icons',
            name: 'App Icons',
            description:
              'Multiple icon sizes for different devices and contexts',
            apiName: 'icons',
            canIUseId: 'web-app-manifest'
          },
          {
            id: 'theme-color',
            name: 'Theme Color',
            description: 'Customize browser UI color',
            apiName: 'theme_color',
            canIUseId: 'web-app-manifest'
          },
          {
            id: 'background-color',
            name: 'Background Color',
            description: 'Splash screen background color',
            apiName: 'background_color',
            canIUseId: 'web-app-manifest'
          },
          {
            id: 'orientation',
            name: 'Orientation Preferences',
            description: 'Specify preferred screen orientation',
            apiName: 'orientation',
            canIUseId: 'web-app-manifest'
          },
          {
            id: 'scope',
            name: 'Scope Definition',
            description: 'Define navigation scope of the PWA',
            apiName: 'scope',
            canIUseId: 'web-app-manifest'
          },
          {
            id: 'start-url',
            name: 'Start URL',
            description: 'URL to load when app is launched',
            apiName: 'start_url',
            canIUseId: 'web-app-manifest'
          }
        ]
      },
      {
        id: 'service-workers',
        name: 'Service Workers',
        description:
          'Background scripts that enable offline functionality and caching',
        features: [
          {
            id: 'service-worker-registration',
            name: 'Service Worker Registration',
            description: 'Register and manage service workers',
            apiName: 'ServiceWorkerRegistration',
            canIUseId: 'serviceworkers'
          },
          {
            id: 'caching-strategies',
            name: 'Caching Strategies',
            description: 'Implement various caching patterns',
            apiName: 'Cache',
            canIUseId: 'serviceworkers'
          },
          {
            id: 'cache-management',
            name: 'Cache Management',
            description: 'Manage cached resources',
            apiName: 'CacheStorage',
            canIUseId: 'serviceworkers'
          },
          {
            id: 'request-interception',
            name: 'Request Interception',
            description: 'Intercept and handle network requests',
            apiName: 'fetch event',
            canIUseId: 'serviceworkers'
          },
          {
            id: 'update-handling',
            name: 'Update Handling',
            description: 'Manage service worker updates',
            apiName: 'updatefound',
            canIUseId: 'serviceworkers'
          }
        ]
      },
      {
        id: 'offline-support',
        name: 'Offline Support',
        description: 'Features enabling offline functionality',
        features: [
          {
            id: 'offline-page',
            name: 'Offline Page',
            description: 'Display custom page when offline',
            apiName: 'offline fallback',
            canIUseId: 'serviceworkers'
          },
          {
            id: 'cache-first',
            name: 'Cache-First Strategy',
            description: 'Serve from cache first, fall back to network',
            apiName: 'cache-first',
            canIUseId: 'serviceworkers'
          },
          {
            id: 'network-first',
            name: 'Network-First Strategy',
            description: 'Try network first, fall back to cache',
            apiName: 'network-first',
            canIUseId: 'serviceworkers'
          },
          {
            id: 'stale-while-revalidate',
            name: 'Stale-While-Revalidate',
            description: 'Serve from cache while updating in background',
            apiName: 'stale-while-revalidate',
            canIUseId: 'serviceworkers'
          },
          {
            id: 'indexeddb',
            name: 'IndexedDB',
            description: 'Client-side structured data storage',
            apiName: 'IndexedDB',
            canIUseId: 'indexeddb'
          }
        ]
      }
    ]
  },
  {
    id: 'notifications-communication',
    name: 'Notifications & Communication',
    description: 'Push notifications, badges, and communication features',
    icon: 'i-heroicons-bell',
    categories: [
      {
        id: 'push-notifications',
        name: 'Push Notifications',
        description: 'Send and display push notifications',
        features: [
          {
            id: 'push-api',
            name: 'Push API',
            description: 'Receive push messages from server',
            apiName: 'Push API',
            canIUseId: 'push-api'
          },
          {
            id: 'declarative-web-push',
            name: 'Declarative Web Push',
            description: 'Simplified push notifications without service worker',
            apiName: 'Declarative Web Push'
          },
          {
            id: 'notification-api',
            name: 'Notification API',
            description: 'Display system notifications',
            apiName: 'Notification',
            canIUseId: 'notifications'
          },
          {
            id: 'notification-actions',
            name: 'Notification Actions',
            description: 'Add action buttons to notifications',
            apiName: 'actions',
            canIUseId: 'notifications'
          },
          {
            id: 'notification-badges',
            name: 'Notification Badges',
            description: 'Show badges on notifications',
            apiName: 'badge',
            canIUseId: 'notifications'
          },
          {
            id: 'silent-push',
            name: 'Silent Push',
            description: 'Receive push without displaying notification',
            apiName: 'silent push',
            canIUseId: 'push-api'
          }
        ]
      },
      {
        id: 'badging',
        name: 'Badging',
        description: 'Display badges on app icon',
        features: [
          {
            id: 'app-icon-badges',
            name: 'App Icon Badges',
            description: 'Show badge on app icon',
            apiName: 'Badge API',
            canIUseId: 'badge'
          },
          {
            id: 'notification-count',
            name: 'Notification Count Display',
            description: 'Display count of unread notifications',
            apiName: 'setAppBadge',
            canIUseId: 'badge'
          }
        ]
      }
    ]
  },
  {
    id: 'background-capabilities',
    name: 'Background Capabilities',
    description: 'Background synchronization and fetch operations',
    icon: 'i-heroicons-clock',
    categories: [
      {
        id: 'background-sync',
        name: 'Background Sync',
        description: 'Synchronize data in the background',
        features: [
          {
            id: 'background-sync-api',
            name: 'Background Sync API',
            description: 'Defer actions until user has connectivity',
            apiName: 'Background Sync',
            canIUseId: 'background-sync'
          },
          {
            id: 'periodic-background-sync',
            name: 'Periodic Background Sync',
            description: 'Periodically sync data in background',
            apiName: 'Periodic Background Sync',
            canIUseId: 'periodic-background-sync'
          },
          {
            id: 'deferred-actions',
            name: 'Deferred Actions',
            description: 'Queue actions to execute when online',
            apiName: 'sync event',
            canIUseId: 'background-sync'
          }
        ]
      },
      {
        id: 'background-fetch',
        name: 'Background Fetch',
        description: 'Download/upload large files in background',
        features: [
          {
            id: 'background-fetch-api',
            name: 'Background Fetch API',
            description: 'Handle large downloads/uploads in background',
            apiName: 'Background Fetch',
            canIUseId: 'background-fetch'
          },
          {
            id: 'upload-resilience',
            name: 'Upload Resilience',
            description: 'Resume interrupted uploads',
            apiName: 'Background Fetch',
            canIUseId: 'background-fetch'
          },
          {
            id: 'progress-tracking',
            name: 'Progress Tracking',
            description: 'Track download/upload progress',
            apiName: 'BackgroundFetchRegistration',
            canIUseId: 'background-fetch'
          }
        ]
      }
    ]
  },
  {
    id: 'device-hardware',
    name: 'Device Hardware Access',
    description: 'Access to device sensors, location, and hardware interfaces',
    icon: 'i-heroicons-device-phone-mobile',
    categories: [
      {
        id: 'location-motion',
        name: 'Location & Motion',
        description: 'Location and motion sensors',
        features: [
          {
            id: 'geolocation',
            name: 'Geolocation API',
            description: 'Access device location',
            apiName: 'Geolocation',
            canIUseId: 'geolocation'
          },
          {
            id: 'device-orientation',
            name: 'Device Orientation',
            description: 'Detect device orientation',
            apiName: 'DeviceOrientationEvent',
            canIUseId: 'deviceorientation'
          },
          {
            id: 'device-motion',
            name: 'Device Motion',
            description: 'Detect device acceleration and rotation',
            apiName: 'DeviceMotionEvent',
            canIUseId: 'deviceorientation'
          },
          {
            id: 'accelerometer',
            name: 'Accelerometer',
            description: 'Access accelerometer sensor',
            apiName: 'Accelerometer',
            canIUseId: 'accelerometer'
          },
          {
            id: 'gyroscope',
            name: 'Gyroscope',
            description: 'Access gyroscope sensor',
            apiName: 'Gyroscope',
            canIUseId: 'gyroscope'
          },
          {
            id: 'magnetometer',
            name: 'Magnetometer',
            description: 'Access magnetometer sensor',
            apiName: 'Magnetometer',
            canIUseId: 'magnetometer'
          }
        ]
      },
      {
        id: 'sensors',
        name: 'Sensors',
        description: 'Environmental and ambient sensors',
        features: [
          {
            id: 'ambient-light',
            name: 'Ambient Light Sensor',
            description: 'Detect ambient light levels',
            apiName: 'AmbientLightSensor',
            canIUseId: 'ambient-light'
          },
          {
            id: 'proximity',
            name: 'Proximity Sensor',
            description: 'Detect proximity to device',
            apiName: 'ProximitySensor'
          }
        ]
      },
      {
        id: 'connectivity',
        name: 'Connectivity',
        description: 'Hardware connectivity interfaces',
        features: [
          {
            id: 'web-bluetooth',
            name: 'Bluetooth API',
            description: 'Connect to Bluetooth devices',
            apiName: 'Web Bluetooth',
            canIUseId: 'web-bluetooth'
          },
          {
            id: 'web-nfc',
            name: 'NFC',
            description: 'Read and write NFC tags',
            apiName: 'Web NFC',
            canIUseId: 'webnfc'
          },
          {
            id: 'web-usb',
            name: 'USB',
            description: 'Access USB devices',
            apiName: 'WebUSB',
            canIUseId: 'webusb'
          },
          {
            id: 'web-serial',
            name: 'Serial API',
            description: 'Communicate with serial devices',
            apiName: 'Web Serial',
            canIUseId: 'web-serial'
          }
        ]
      },
      {
        id: 'biometrics-security',
        name: 'Biometrics & Security',
        description: 'Biometric authentication and security',
        features: [
          {
            id: 'webauthn',
            name: 'WebAuthn',
            description: 'Biometric and hardware authentication',
            apiName: 'WebAuthn',
            canIUseId: 'webauthn'
          },
          {
            id: 'credential-management',
            name: 'Credential Management API',
            description: 'Store and retrieve credentials',
            apiName: 'Credential Management',
            canIUseId: 'credential-management'
          },
          {
            id: 'biometric-integration',
            name: 'Face ID / Touch ID Integration',
            description: 'Native biometric authentication',
            apiName: 'PublicKeyCredential',
            canIUseId: 'webauthn'
          }
        ]
      }
    ]
  },
  {
    id: 'media-capture',
    name: 'Media Capture & Processing',
    description: 'Camera, microphone, screen capture, and media processing',
    icon: 'i-heroicons-camera',
    categories: [
      {
        id: 'camera-microphone',
        name: 'Camera & Microphone',
        description: 'Access camera and microphone',
        features: [
          {
            id: 'media-capture',
            name: 'Media Capture API',
            description: 'Capture photo and video',
            apiName: 'MediaDevices',
            canIUseId: 'stream'
          },
          {
            id: 'getusermedia',
            name: 'getUserMedia',
            description: 'Access camera and microphone',
            apiName: 'getUserMedia',
            canIUseId: 'stream'
          },
          {
            id: 'video-recording',
            name: 'Video Recording',
            description: 'Record video from camera',
            apiName: 'MediaRecorder',
            canIUseId: 'mediarecorder'
          },
          {
            id: 'audio-recording',
            name: 'Audio Recording',
            description: 'Record audio from microphone',
            apiName: 'MediaRecorder',
            canIUseId: 'mediarecorder'
          },
          {
            id: 'photo-capture',
            name: 'Photo Capture',
            description: 'Capture still images',
            apiName: 'ImageCapture',
            canIUseId: 'imagecapture'
          }
        ]
      },
      {
        id: 'screen-capture',
        name: 'Screen Capture',
        description: 'Capture screen content',
        features: [
          {
            id: 'getdisplaymedia',
            name: 'Screen Capture API',
            description: 'Capture screen, window, or tab',
            apiName: 'getDisplayMedia',
            canIUseId: 'mdn-api_mediadevices_getdisplaymedia'
          },
          {
            id: 'element-capture',
            name: 'Element Capture',
            description: 'Capture specific DOM elements',
            apiName: 'Element Capture'
          },
          {
            id: 'region-capture',
            name: 'Region Capture',
            description: 'Capture specific screen regions',
            apiName: 'Region Capture'
          }
        ]
      },
      {
        id: 'media-playback',
        name: 'Media Playback',
        description: 'Audio and video playback features',
        features: [
          {
            id: 'media-source',
            name: 'Media Source Extensions',
            description: 'Adaptive streaming and media buffering control',
            apiName: 'MediaSource',
            canIUseId: 'mediasource'
          },
          {
            id: 'audio-playback',
            name: 'Audio Playback',
            description: 'Play audio files',
            apiName: 'HTMLAudioElement'
          },
          {
            id: 'video-playback',
            name: 'Video Playback',
            description: 'Play video files',
            apiName: 'HTMLVideoElement'
          },
          {
            id: 'media-session',
            name: 'Media Session API',
            description: 'Control media playback from system UI',
            apiName: 'MediaSession',
            canIUseId: 'mediasession'
          },
          {
            id: 'picture-in-picture',
            name: 'Picture-in-Picture',
            description: 'Float video in small window',
            apiName: 'Picture-in-Picture',
            canIUseId: 'picture-in-picture'
          },
          {
            id: 'background-audio',
            name: 'Background Audio',
            description: 'Continue audio playback in background',
            apiName: 'Audio Focus'
          }
        ]
      },
      {
        id: 'detection-apis',
        name: 'Detection APIs',
        description: 'Computer vision and detection features',
        features: [
          {
            id: 'barcode-detection',
            name: 'Barcode Detection',
            description: 'Detect barcodes in images',
            apiName: 'BarcodeDetector',
            canIUseId: 'barcode-detection'
          },
          {
            id: 'qr-code',
            name: 'QR Code Scanning',
            description: 'Scan QR codes',
            apiName: 'BarcodeDetector',
            canIUseId: 'barcode-detection'
          },
          {
            id: 'face-detection',
            name: 'Face Detection',
            description: 'Detect faces in images',
            apiName: 'FaceDetector',
            canIUseId: 'shape-detection'
          },
          {
            id: 'text-detection',
            name: 'Text Detection',
            description: 'Detect text in images (OCR)',
            apiName: 'TextDetector',
            canIUseId: 'shape-detection'
          },
          {
            id: 'shape-detection',
            name: 'Shape Detection API',
            description: 'Detect shapes in images',
            apiName: 'Shape Detection',
            canIUseId: 'shape-detection'
          }
        ]
      }
    ]
  },
  {
    id: 'file-data-management',
    icon: 'i-heroicons-folder',
    name: 'File & Data Management',
    description: 'File system access, storage, and clipboard operations',
    categories: [
      {
        id: 'file-system',
        name: 'File System',
        description: 'Access and manage files',
        features: [
          {
            id: 'filereader',
            name: 'FileReader API',
            description: 'Read file contents asynchronously',
            apiName: 'FileReader',
            canIUseId: 'filereader'
          },
          {
            id: 'blob-urls',
            name: 'Blob URLs',
            description: 'Create object URLs for blobs and files',
            apiName: 'URL.createObjectURL',
            canIUseId: 'bloburls'
          },
          {
            id: 'file-system-access',
            name: 'File System Access API',
            description: 'Read and write files on device',
            apiName: 'File System Access',
            canIUseId: 'native-filesystem-api'
          },
          {
            id: 'file-handling',
            name: 'File Handling API',
            description: 'Register as handler for file types',
            apiName: 'File Handling',
            canIUseId: 'web-share'
          },
          {
            id: 'drag-drop',
            name: 'Drag and Drop',
            description: 'Drag and drop files',
            apiName: 'DataTransfer',
            canIUseId: 'dragndrop'
          },
          {
            id: 'file-picker',
            name: 'File Picker',
            description: 'Select files from device',
            apiName: 'showOpenFilePicker',
            canIUseId: 'native-filesystem-api'
          },
          {
            id: 'directory-access',
            name: 'Directory Access',
            description: 'Access entire directories',
            apiName: 'showDirectoryPicker',
            canIUseId: 'native-filesystem-api'
          },
          {
            id: 'opfs',
            name: 'Origin Private File System',
            description: 'Private file system for app data',
            apiName: 'OPFS',
            canIUseId: 'native-filesystem-api'
          }
        ]
      },
      {
        id: 'storage',
        name: 'Storage',
        description: 'Data storage mechanisms',
        features: [
          {
            id: 'indexeddb-storage',
            name: 'IndexedDB',
            description: 'Large-scale structured data storage',
            apiName: 'IndexedDB',
            canIUseId: 'indexeddb'
          },
          {
            id: 'localstorage',
            name: 'localStorage',
            description: 'Simple key-value storage',
            apiName: 'localStorage',
            canIUseId: 'namevalue-storage'
          },
          {
            id: 'sessionstorage',
            name: 'sessionStorage',
            description: 'Session-scoped storage',
            apiName: 'sessionStorage',
            canIUseId: 'namevalue-storage'
          },
          {
            id: 'cache-api',
            name: 'Cache API',
            description: 'Cache HTTP responses',
            apiName: 'Cache',
            canIUseId: 'mdn-api_cache'
          },
          {
            id: 'storage-manager',
            name: 'Storage Manager API',
            description: 'Manage storage quota and persistence',
            apiName: 'StorageManager',
            canIUseId: 'mdn-api_storagemanager'
          },
          {
            id: 'storage-quota',
            name: 'Storage Quota Management',
            description: 'Check and request storage quota',
            apiName: 'estimate',
            canIUseId: 'mdn-api_storagemanager'
          },
          {
            id: 'persistent-storage',
            name: 'Persistent Storage',
            description: 'Request persistent storage permission',
            apiName: 'persist',
            canIUseId: 'mdn-api_storagemanager_persist'
          }
        ]
      },
      {
        id: 'clipboard',
        name: 'Clipboard',
        description: 'Clipboard operations',
        features: [
          {
            id: 'clipboard-api',
            name: 'Clipboard API',
            description: 'Read from and write to clipboard',
            apiName: 'Clipboard',
            canIUseId: 'mdn-api_clipboard'
          },
          {
            id: 'copy-paste',
            name: 'Copy/Paste Functionality',
            description: 'Copy and paste text and images',
            apiName: 'clipboard.write',
            canIUseId: 'async-clipboard'
          },
          {
            id: 'async-clipboard',
            name: 'Async Clipboard Access',
            description: 'Asynchronous clipboard operations',
            apiName: 'navigator.clipboard',
            canIUseId: 'async-clipboard'
          }
        ]
      }
    ]
  },
  {
    id: 'ui-ux',
    icon: 'i-heroicons-sparkles',
    name: 'User Interface & Experience',
    description: 'Display control, visual effects, input methods, and haptics',
    categories: [
      {
        id: 'display-viewport',
        name: 'Display & Viewport',
        description: 'Display and viewport control',
        features: [
          {
            id: 'viewport-control',
            name: 'Viewport Control',
            description: 'Control viewport properties',
            apiName: 'viewport meta tag'
          },
          {
            id: 'fullscreen',
            name: 'Fullscreen API',
            description: 'Enter and exit fullscreen mode',
            apiName: 'Fullscreen',
            canIUseId: 'fullscreen'
          },
          {
            id: 'screen-orientation',
            name: 'Screen Orientation API',
            description: 'Lock and detect screen orientation',
            apiName: 'ScreenOrientation',
            canIUseId: 'screen-orientation'
          },
          {
            id: 'display-modes-ux',
            name: 'Display Modes',
            description: 'Different app display modes',
            apiName: 'display-mode'
          }
        ]
      },
      {
        id: 'visual-effects',
        name: 'Visual Effects',
        description: 'Visual transitions and animations',
        features: [
          {
            id: 'view-transitions',
            name: 'View Transitions API',
            description: 'Smooth transitions between views',
            apiName: 'View Transitions',
            canIUseId: 'mdn-api_viewtransition'
          },
          {
            id: 'web-animations',
            name: 'Web Animations API',
            description: 'Programmatic animations',
            apiName: 'Animation',
            canIUseId: 'web-animation'
          }
        ]
      },
      {
        id: 'input-methods',
        name: 'Input Methods',
        description: 'Various input method support',
        features: [
          {
            id: 'multi-touch',
            name: 'Multi-touch Support',
            description: 'Handle multi-touch gestures',
            apiName: 'TouchEvent',
            canIUseId: 'touch'
          },
          {
            id: 'pointer-events',
            name: 'Pointer Events',
            description: 'Unified input event handling',
            apiName: 'PointerEvent',
            canIUseId: 'pointer'
          },
          {
            id: 'keyboard-api',
            name: 'Keyboard API',
            description: 'Advanced keyboard input handling',
            apiName: 'Keyboard',
            canIUseId: 'mdn-api_keyboard'
          },
          {
            id: 'virtual-keyboard',
            name: 'Virtual Keyboard API',
            description: 'Control virtual keyboard behavior',
            apiName: 'VirtualKeyboard',
            canIUseId: 'mdn-api_virtualkeyboard'
          }
        ]
      },
      {
        id: 'haptics',
        name: 'Haptics',
        description: 'Tactile feedback',
        features: [
          {
            id: 'vibration',
            name: 'Vibration API',
            description: 'Trigger device vibration',
            apiName: 'Vibration',
            canIUseId: 'vibration'
          },
          {
            id: 'haptic-patterns',
            name: 'Haptic Feedback Patterns',
            description: 'Create complex vibration patterns',
            apiName: 'navigator.vibrate',
            canIUseId: 'vibration'
          }
        ]
      }
    ]
  },
  {
    id: 'system-integration',
    icon: 'i-heroicons-link',
    name: 'System Integration',
    description: 'Integration with device OS and system features',
    categories: [
      {
        id: 'sharing',
        name: 'Sharing',
        description: 'Share and receive content',
        features: [
          {
            id: 'web-share',
            name: 'Web Share API',
            description: 'Share content to other apps',
            apiName: 'Web Share',
            canIUseId: 'web-share'
          },
          {
            id: 'web-share-target',
            name: 'Web Share Target API',
            description: 'Receive shared content from other apps',
            apiName: 'Web Share Target',
            canIUseId: 'web-share'
          }
        ]
      },
      {
        id: 'contacts',
        name: 'Contacts',
        description: 'Access device contacts',
        features: [
          {
            id: 'contact-picker',
            name: 'Contact Picker API',
            description: 'Select contacts from device',
            apiName: 'Contact Picker',
            canIUseId: 'mdn-api_contactsmanager'
          }
        ]
      },
      {
        id: 'protocol-handling',
        name: 'Protocol Handling',
        description: 'Handle custom URL schemes',
        features: [
          {
            id: 'protocol-handlers',
            name: 'Custom Protocol Handlers',
            description: 'Register custom URL protocol handlers',
            apiName: 'registerProtocolHandler',
            canIUseId: 'registerprotocolhandler'
          },
          {
            id: 'url-scheme-handling',
            name: 'URL Scheme Handling',
            description: 'Handle custom URL schemes',
            apiName: 'protocol_handlers'
          }
        ]
      },
      {
        id: 'file-associations',
        name: 'File Associations',
        description: 'Associate with file types',
        features: [
          {
            id: 'file-type-associations',
            name: 'File Type Associations',
            description: 'Register as handler for file types',
            apiName: 'file_handlers'
          },
          {
            id: 'open-with-pwa',
            name: 'Open with PWA',
            description: 'Open files with PWA from system',
            apiName: 'LaunchQueue'
          }
        ]
      },
      {
        id: 'app-shortcuts',
        name: 'App Shortcuts',
        description: 'Quick actions and shortcuts',
        features: [
          {
            id: 'manifest-shortcuts',
            name: 'App Shortcuts in Manifest',
            description: 'Define shortcuts in manifest',
            apiName: 'shortcuts',
            canIUseId: 'web-app-manifest'
          },
          {
            id: 'jump-list',
            name: 'Jump List Items',
            description: 'Windows jump list integration',
            apiName: 'shortcuts'
          },
          {
            id: 'quick-actions',
            name: 'Quick Actions',
            description: 'Context menu quick actions',
            apiName: 'shortcuts'
          }
        ]
      }
    ]
  },
  {
    id: 'audio-speech',
    icon: 'i-heroicons-speaker-wave',
    name: 'Audio & Speech',
    description: 'Speech synthesis, recognition, and audio processing',
    categories: [
      {
        id: 'speech-synthesis',
        name: 'Speech Synthesis',
        description: 'Text-to-speech capabilities',
        features: [
          {
            id: 'tts',
            name: 'Text-to-Speech API',
            description: 'Convert text to speech',
            apiName: 'SpeechSynthesis',
            canIUseId: 'speech-synthesis'
          },
          {
            id: 'voice-selection',
            name: 'Voice Selection',
            description: 'Choose different voices',
            apiName: 'SpeechSynthesisVoice',
            canIUseId: 'speech-synthesis'
          },
          {
            id: 'speech-control',
            name: 'Speech Rate/Pitch/Volume Control',
            description: 'Control speech parameters',
            apiName: 'SpeechSynthesisUtterance',
            canIUseId: 'speech-synthesis'
          }
        ]
      },
      {
        id: 'speech-recognition',
        name: 'Speech Recognition',
        description: 'Speech-to-text capabilities',
        features: [
          {
            id: 'stt',
            name: 'Speech-to-Text API',
            description: 'Convert speech to text',
            apiName: 'SpeechRecognition',
            canIUseId: 'speech-recognition'
          },
          {
            id: 'continuous-recognition',
            name: 'Continuous Recognition',
            description: 'Continuous speech recognition',
            apiName: 'continuous',
            canIUseId: 'speech-recognition'
          },
          {
            id: 'interim-results',
            name: 'Interim Results',
            description: 'Get intermediate recognition results',
            apiName: 'interimResults',
            canIUseId: 'speech-recognition'
          }
        ]
      },
      {
        id: 'audio-apis',
        name: 'Audio APIs',
        description: 'Advanced audio processing',
        features: [
          {
            id: 'web-audio',
            name: 'Web Audio API',
            description: 'Process and synthesize audio',
            apiName: 'Web Audio',
            canIUseId: 'audio-api'
          },
          {
            id: 'audio-context',
            name: 'Audio Context',
            description: 'Audio processing graph',
            apiName: 'AudioContext',
            canIUseId: 'audio-api'
          },
          {
            id: 'audio-processing',
            name: 'Audio Processing',
            description: 'Real-time audio effects',
            apiName: 'AudioWorklet',
            canIUseId: 'audio-api'
          }
        ]
      }
    ]
  },
  {
    id: 'network-communication',
    icon: 'i-heroicons-signal',
    name: 'Network & Communication',
    description: 'Network information, connectivity, and data fetching',
    categories: [
      {
        id: 'network-information',
        name: 'Network Information',
        description: 'Network status and properties',
        features: [
          {
            id: 'network-info-api',
            name: 'Network Information API',
            description: 'Access network connection information',
            apiName: 'NetworkInformation',
            canIUseId: 'netinfo'
          },
          {
            id: 'connection-type',
            name: 'Connection Type Detection',
            description: 'Detect connection type (wifi, cellular, etc.)',
            apiName: 'effectiveType',
            canIUseId: 'netinfo'
          },
          {
            id: 'bandwidth',
            name: 'Effective Bandwidth',
            description: 'Estimate network bandwidth',
            apiName: 'downlink',
            canIUseId: 'netinfo'
          },
          {
            id: 'save-data',
            name: 'Save-Data Header',
            description: 'Detect data saver mode',
            apiName: 'saveData',
            canIUseId: 'netinfo'
          }
        ]
      },
      {
        id: 'online-offline',
        name: 'Online/Offline Detection',
        description: 'Connection status',
        features: [
          {
            id: 'online-events',
            name: 'Online/Offline Events',
            description: 'Listen for connectivity changes',
            apiName: 'online/offline events',
            canIUseId: 'online-status'
          },
          {
            id: 'connection-status',
            name: 'Connection Status',
            description: 'Check if device is online',
            apiName: 'navigator.onLine',
            canIUseId: 'online-status'
          }
        ]
      },
      {
        id: 'cross-context',
        name: 'Cross-Context Communication',
        description: 'Communication between tabs, workers, and windows',
        features: [
          {
            id: 'broadcast-channel',
            name: 'BroadcastChannel API',
            description: 'Communicate between tabs and workers',
            apiName: 'BroadcastChannel',
            canIUseId: 'broadcastchannel'
          },
          {
            id: 'message-channel',
            name: 'MessageChannel API',
            description: 'Structured message passing between contexts',
            apiName: 'MessageChannel',
            canIUseId: 'channel-messaging'
          }
        ]
      },
      {
        id: 'fetch-requests',
        name: 'Fetch & Requests',
        description: 'Modern HTTP requests',
        features: [
          {
            id: 'beacon',
            name: 'Beacon API',
            description: 'Send analytics data on page unload',
            apiName: 'navigator.sendBeacon',
            canIUseId: 'beacon'
          },
          {
            id: 'fetch-api',
            name: 'Fetch API',
            description: 'Modern HTTP request API',
            apiName: 'fetch',
            canIUseId: 'fetch'
          },
          {
            id: 'request-response',
            name: 'Request/Response Objects',
            description: 'HTTP request and response objects',
            apiName: 'Request/Response',
            canIUseId: 'fetch'
          },
          {
            id: 'streaming',
            name: 'Streaming',
            description: 'Stream request and response bodies',
            apiName: 'ReadableStream',
            canIUseId: 'streams'
          }
        ]
      }
    ]
  },
  {
    id: 'payments-commerce',
    icon: 'i-heroicons-credit-card',
    name: 'Payments & Commerce',
    description: 'Payment processing and digital wallet integration',
    categories: [
      {
        id: 'payment-processing',
        name: 'Payment Processing',
        description: 'Process payments',
        features: [
          {
            id: 'payment-request',
            name: 'Payment Request API',
            description: 'Request payment from user',
            apiName: 'Payment Request',
            canIUseId: 'payment-request'
          },
          {
            id: 'payment-handler',
            name: 'Payment Handler API',
            description: 'Implement payment methods',
            apiName: 'Payment Handler',
            canIUseId: 'payment-request'
          },
          {
            id: 'apple-pay',
            name: 'Apple Pay',
            description: 'Apple Pay integration',
            apiName: 'ApplePaySession'
          },
          {
            id: 'google-pay',
            name: 'Google Pay',
            description: 'Google Pay integration',
            apiName: 'Google Pay API'
          },
          {
            id: 'digital-wallets',
            name: 'Digital Wallets',
            description: 'Digital wallet integration',
            apiName: 'PaymentRequest',
            canIUseId: 'payment-request'
          }
        ]
      }
    ]
  },
  {
    id: 'advanced-capabilities',
    icon: 'i-heroicons-rocket-launch',
    name: 'Advanced Capabilities',
    description: 'AR/VR, performance optimization, WebAssembly, and workers',
    categories: [
      {
        id: 'ar-vr',
        name: 'AR/VR',
        description: 'Augmented and virtual reality',
        features: [
          {
            id: 'webxr',
            name: 'WebXR Device API',
            description: 'VR and AR experiences',
            apiName: 'WebXR',
            canIUseId: 'webxr'
          },
          {
            id: 'augmented-reality',
            name: 'Augmented Reality',
            description: 'AR features and tracking',
            apiName: 'XRSession',
            canIUseId: 'webxr'
          },
          {
            id: 'virtual-reality',
            name: 'Virtual Reality',
            description: 'VR headset support',
            apiName: 'XRSession',
            canIUseId: 'webxr'
          },
          {
            id: 'immersive-experiences',
            name: 'Immersive Experiences',
            description: 'Immersive VR/AR sessions',
            apiName: 'immersive-vr',
            canIUseId: 'webxr'
          }
        ]
      },
      {
        id: 'performance',
        name: 'Performance',
        description: 'Performance optimization features',
        features: [
          {
            id: 'request-idle-callback',
            name: 'RequestIdleCallback',
            description: 'Run low-priority work during browser idle time',
            apiName: 'requestIdleCallback',
            canIUseId: 'requestidlecallback'
          },
          {
            id: 'wake-lock',
            name: 'Wake Lock API',
            description: 'Prevent screen from sleeping',
            apiName: 'Wake Lock',
            canIUseId: 'wake-lock'
          },
          {
            id: 'idle-detection',
            name: 'Idle Detection API',
            description: 'Detect user idle state',
            apiName: 'Idle Detection',
            canIUseId: 'mdn-api_idledetector'
          },
          {
            id: 'performance-apis',
            name: 'Performance APIs',
            description: 'Measure and optimize performance',
            apiName: 'Performance',
            canIUseId: 'performance-timeline'
          },
          {
            id: 'web-vitals',
            name: 'Web Vitals Tracking',
            description: 'Track Core Web Vitals',
            apiName: 'PerformanceObserver',
            canIUseId: 'performance-timeline'
          }
        ]
      },
      {
        id: 'webassembly',
        name: 'WebAssembly',
        description: 'High-performance compiled code',
        features: [
          {
            id: 'wasm-support',
            name: 'WASM Support',
            description: 'Run WebAssembly modules',
            apiName: 'WebAssembly',
            canIUseId: 'wasm'
          },
          {
            id: 'high-performance-computing',
            name: 'High-Performance Computing',
            description: 'CPU-intensive computations',
            apiName: 'WebAssembly.instantiate',
            canIUseId: 'wasm'
          }
        ]
      },
      {
        id: 'workers',
        name: 'Web Workers',
        description: 'Background processing threads',
        features: [
          {
            id: 'offscreen-canvas',
            name: 'OffscreenCanvas',
            description: 'Canvas rendering in workers',
            apiName: 'OffscreenCanvas',
            canIUseId: 'offscreencanvas'
          },
          {
            id: 'background-processing',
            name: 'Background Processing',
            description: 'Run code in background thread',
            apiName: 'Worker',
            canIUseId: 'webworkers'
          },
          {
            id: 'dedicated-workers',
            name: 'Dedicated Workers',
            description: 'Single-page background workers',
            apiName: 'Worker',
            canIUseId: 'webworkers'
          },
          {
            id: 'shared-workers',
            name: 'Shared Workers',
            description: 'Shared across multiple pages',
            apiName: 'SharedWorker',
            canIUseId: 'sharedworkers'
          }
        ]
      },
      {
        id: 'streams',
        name: 'Streams',
        description: 'Stream processing',
        features: [
          {
            id: 'streams-api',
            name: 'Streams API',
            description: 'Process streaming data',
            apiName: 'Streams',
            canIUseId: 'streams'
          },
          {
            id: 'readable-streams',
            name: 'Readable Streams',
            description: 'Read streaming data',
            apiName: 'ReadableStream',
            canIUseId: 'streams'
          },
          {
            id: 'writable-streams',
            name: 'Writable Streams',
            description: 'Write streaming data',
            apiName: 'WritableStream',
            canIUseId: 'streams'
          },
          {
            id: 'transform-streams',
            name: 'Transform Streams',
            description: 'Transform streaming data',
            apiName: 'TransformStream',
            canIUseId: 'streams'
          }
        ]
      }
    ]
  },
  {
    id: 'security-privacy',
    icon: 'i-heroicons-shield-check',
    name: 'Security & Privacy',
    description: 'Permissions, security policies, and privacy features',
    categories: [
      {
        id: 'permissions',
        name: 'Permissions',
        description: 'Manage permissions',
        features: [
          {
            id: 'permissions-api',
            name: 'Permissions API',
            description: 'Query and request permissions',
            apiName: 'Permissions',
            canIUseId: 'permissions-api'
          },
          {
            id: 'permission-prompts',
            name: 'Permission Prompts',
            description: 'Request user permissions',
            apiName: 'requestPermission',
            canIUseId: 'permissions-api'
          },
          {
            id: 'permission-states',
            name: 'Permission States',
            description: 'Check permission status',
            apiName: 'query',
            canIUseId: 'permissions-api'
          }
        ]
      },
      {
        id: 'security',
        name: 'Security',
        description: 'Security features and policies',
        features: [
          {
            id: 'https-requirement',
            name: 'HTTPS Requirement',
            description: 'PWAs require HTTPS',
            apiName: 'Secure Context'
          },
          {
            id: 'csp',
            name: 'Content Security Policy',
            description: 'Control resource loading',
            apiName: 'CSP',
            canIUseId: 'contentsecuritypolicy'
          },
          {
            id: 'secure-contexts',
            name: 'Secure Contexts',
            description: 'APIs restricted to secure contexts',
            apiName: 'isSecureContext'
          },
          {
            id: 'same-origin-policy',
            name: 'Same-Origin Policy',
            description: 'Cross-origin security',
            apiName: 'CORS'
          }
        ]
      }
    ]
  },
  {
    id: 'window-management',
    icon: 'i-lucide-layout-grid',
    name: 'Window Management',
    description: 'Multi-window and window control features',
    categories: [
      {
        id: 'multi-window',
        name: 'Multi-Window',
        description: 'Multiple window support',
        features: [
          {
            id: 'window-controls-overlay',
            name: 'Window Controls Overlay',
            description: 'Customize title bar area',
            apiName: 'Window Controls Overlay',
            canIUseId: 'mdn-api_windowcontrolsoverlay'
          },
          {
            id: 'display-mode-override',
            name: 'Display Mode Override',
            description: 'Override display mode',
            apiName: 'display_override',
            canIUseId: 'web-app-manifest'
          },
          {
            id: 'tabbed-mode',
            name: 'Tabbed Application Mode',
            description: 'Multiple app windows as tabs',
            apiName: 'tabbed',
            canIUseId: 'web-app-manifest'
          }
        ]
      }
    ]
  }
]

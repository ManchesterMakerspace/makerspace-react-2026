# Mobile build environment

| Variable | Purpose | Secret |
| --- | --- | --- |
| `NATIVE_API_ORIGIN` | Required HTTPS portal origin for `native.config.js`. Web builds default to their own origin. No path/trailing slash. Compiled into native assets. | No |
| `JAVA_HOME` | JDK 21 used by Gradle | No |
| `ANDROID_HOME` | Local Android SDK installation | No |
| `ANDROID_KEYSTORE_PATH` | Optional release signing keystore path | Sensitive local path |
| `ANDROID_KEYSTORE_PASSWORD` | Release keystore password | Yes |
| `ANDROID_KEY_ALIAS` | Release signing key alias | No |
| `ANDROID_KEY_PASSWORD` | Release signing key password | Yes |

Native protected-card enrollment requires Rails to receive the existing gateway
`READER_KEY_ENCRYPTION_KEY` through server deployment secrets. It is never a mobile
build variable. Existing `MLAB_URI` must point
to a replica set for transactional card operations. The packaged app uses the
existing Rails session and XSRF cookie mechanisms.

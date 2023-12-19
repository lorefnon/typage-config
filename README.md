# typage-config

A simple utility to partially encrypt configuration files (json/yaml).

Given a config file like: 

```yaml
# config.prod.yaml
db:
    host: "somehost"
    username: "test"
    password: "secret-password"
auth:
    secret: "some-other-secret"
```

typage-config can convert it to:

```yaml
# config.prod.yaml
db:
    host: "{age:61672d656e6372797074696...e710ebb8e51cd1caabfdcb7f2b5545f35eed3}"
    username: "{age:d656e63784302394083221e710ebb8e51cd1caabfdc...b7f2b5545f3e49be65eed3}"
    password: "{age:652d656e6372797074696...021e710ebb8e51cd1abfdcb7f2b5545f49be6ed3}"
auth:
    secret: "{age:67652d6e6372797074696...0e710ebb8e51ccaafdcb7f2b55f3e49beed3}"
```

Where the structure of original config is retained, but the values are encrytped.

This makes it easy to inspect if any keys are missing or some nesting is invalid etc. but at the same time hides the values making 
it safe to transmit the config through an untrusted medium or commit the config file within repo.

Actual encryption is performed through [FiloSottile/typage](https://github.com/FiloSottile/typage) - 
typescript implementation of [age file encryption format](age-encryption.org) which uses libsodium.js under the hood.

## API

First, generate an identity: 

```ts
import age from "age-encryption"

const { generateIdentity } = await age()

const identity: string = generateIdentity()
//^ Save this in a secure location
```

### File level operations

```ts
import { useIdentity, encryptConfigFile, decryptConfigFile } from "typage-config";

useIdentity(identity);

await encryptConfigFile({
    filePath: "config/config.prod.yaml",
    overwrite: true
});

// File has been updated with encrypted values now

// Inside application: 

const config = await decryptConfigFile({
    filePath: "config/config.prod.yaml",
});

// We didn't pass overwrite so file on disc was not modified

// When config file needs to be edited again

await decryptConfigFile({
    filePath: "config/config.prod.yaml",
    overwrite: true
});

// File has been updated with decrypted values now
// cann encryptConfigFile after editing
```

### Config level operations

Lower level API exists to transform a configuration object already loaded in memory

```ts
const original = { /* ... some config object ... */ };
// ^ Must be plain js object - no support for functions, classes etc.

const encrypted = await encryptConfig(original)

// Later

const decrypted = await decryptConfig(encrypted);
// decrypted is equivalent to original
```


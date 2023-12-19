import test from "ava";
import * as uuid from "uuid"
import fs from "node:fs/promises"
import yaml from "js-yaml"
import { encryptConfig, decryptConfig, useIdentity, encryptValue, encryptConfigFile, decryptConfigFile } from "../src/index.js"

test.afterEach(() => {
    useIdentity(undefined as unknown as string)
})

const identities = [
    "AGE-SECRET-KEY-1JCHQKJE5JVA8MA86W43R8WW20MDZR8U7K0QX2TW4UUYLL4NEJ3YSYU3R32"
]

const original = {
    foo: 1,
    bar: "bar",
    baz: {
        bat: {
            cat: [{
                url: "http://you-wont-believe"
            }, {
                url: "https://what-this-points-to"
            }]
        }
    }
}

test("basic config level usage", async (t) => {
    useIdentity(identities[0])
    const encrypted = await encryptConfig(original)
    t.truthy(!!encrypted.foo.match(/^\{age:.*\}$/))
    t.truthy(!!encrypted.baz.bat.cat[0].url.match(/^\{age:.*\}$/))
    const decrypted = await decryptConfig(encrypted);
    t.deepEqual(decrypted, original)
})

test("file level usage", async (t) => {
    useIdentity(identities[0])
    const filePath = "/tmp/" + uuid.v4() + ".yaml"
    console.log({ filePath })
    await fs.writeFile(filePath, yaml.dump(original));
    const encrypted = await encryptConfigFile({
        filePath
    })
    t.truthy(!!encrypted.foo.match(/^\{age:.*\}$/))
    t.truthy(!!encrypted.baz.bat.cat[0].url.match(/^\{age:.*\}$/))
    const decrypted = await decryptConfig(encrypted);
    t.deepEqual(decrypted, original)
    const read = await yaml.load(await fs.readFile(filePath, "utf8"))
    t.deepEqual(read, original);
})

test("file level usage with overwrite", async (t) => {
    useIdentity(identities[0])
    const filePath = "/tmp/" + uuid.v4() + ".yaml"
    console.log({ filePath })
    await fs.writeFile(filePath, yaml.dump(original));
    const encrypted = await encryptConfigFile({
        filePath,
        overwrite: true
    })
    const readEnc = yaml.load(await fs.readFile(filePath, "utf8"))
    t.deepEqual(encrypted, readEnc)
    t.truthy(!!encrypted.foo.match(/^\{age:.*\}$/))
    t.truthy(!!encrypted.baz.bat.cat[0].url.match(/^\{age:.*\}$/))
    const decrypted = await decryptConfigFile({
        filePath,
        overwrite: true
    });
    t.deepEqual(decrypted, original)
    const readDec = yaml.load(await fs.readFile(filePath, "utf8"))
    t.deepEqual(readDec, original);
})


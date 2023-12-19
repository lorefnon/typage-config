import fs from "node:fs/promises";
import yaml, { DumpOptions, LoadOptions } from "js-yaml";

let defaultIdentity: string | undefined;

export function useIdentity(identity: string) {
    defaultIdentity = identity;
}

export type ConfigFormat = "json" | "yaml";

export interface SharedOpts {
    filePath?: string
    format?: ConfigFormat
    identity?: string
}

export interface DecryptOpts extends SharedOpts {
    getDecrypter?: typeof getDecrypter
    yaml?: {
        loadOptions?: LoadOptions
        dumpOptions?: DumpOptions
    }
    json?: {
        reviver?: Parameters<JSON["parse"]>[1]
        replacer?: Parameters<JSON["stringify"]>[1]
    }
}

interface NDecryptOpts extends DecryptOpts {
    decrypter: {
        decrypt(file: Uint8Array, outputFormat?: "uint8array"): Uint8Array;
        decrypt(file: Uint8Array, outputFormat: "text"): string;
    }
}

export interface SharedFileOpts {
    filePath: string
    overwrite?: boolean
    encoding?: BufferEncoding
}

export type DecryptFileOpts = DecryptOpts & SharedFileOpts;

export interface EncryptOpts extends SharedOpts {
    recipient?: string
    getEncrypter?: typeof getEncrypter
    paths?: {
        include?: (path: string[]) => boolean | undefined,
    }
}

interface NEncryptOpts extends EncryptOpts {
    encrypter: {
        encrypt(file: Uint8Array | string): Uint8Array;
    }
}

export type EncryptFileOpts = EncryptOpts & SharedFileOpts;

export async function decryptConfigFile(opts: DecryptFileOpts) {
    return transformFile(decryptConfig, opts);
}

export async function encryptConfigFile(opts: EncryptFileOpts) {
    return transformFile(encryptConfig, opts);
}

async function transformFile<TOpts extends SharedFileOpts>(transform: (source: any, opts: TOpts) => any, opts: TOpts) {
    const encoding = opts?.encoding ?? "utf8"
    const rawContent = await fs.readFile(opts.filePath, encoding);
    const format = inferFormat(opts.filePath, opts)
    const nextOpts = { ...opts, format }
    const parsed = parseConfig(rawContent, nextOpts);
    const transformed = await transform(parsed, nextOpts);
    if (opts.overwrite) {
        const serialized = serializeConfig(transformed, nextOpts);
        await fs.writeFile(opts.filePath, serialized, encoding)
    }
    return transformed;
}

export async function decryptConfig(config: any, opts?: DecryptOpts) {
    return decryptConfigInner(config, {
        ...opts,
        decrypter: await getDecrypter(opts)
    }, [])
}

function decryptConfigInner(config: any, opts: NDecryptOpts, curPath: string[]): any {
    if (!config) return config;
    if (typeof config === "string") {
        const match = config.match(/^\{age:(.*)\}$/)
        if (!match) return config;
        return decryptValue(match[1], opts);
    }
    if (Array.isArray(config)) {
        return config.map((item, idx): any =>
            decryptConfigInner(item, opts, curPath.concat(`${idx}`))
        )
    }
    if (typeof config === "object") {
        return Object.fromEntries(
            Object.entries(config)
                .map(([key, val]) => 
                    [key, decryptConfigInner(val, opts, curPath.concat(key))]
                )
        )
    }
    return config;
}

export function decryptValue(value: string, opts: NDecryptOpts) {
    const encrypted = Buffer.from(value, "hex")
    return JSON.parse(opts.decrypter.decrypt(encrypted, "text"))
}

export function encryptValue(value: any, opts: NEncryptOpts) {
    const enc = opts.encrypter.encrypt(Buffer.from(JSON.stringify(value)))
    const encStr = Buffer.from(enc).toString("hex");
    return `{age:${encStr}}`;
}

export async function encryptConfig(config: any, opts?: EncryptOpts) { 
    return encryptConfigInner(config, {
        ...opts,
        encrypter: await getEncrypter(opts)
    }, []);
}

function encryptConfigInner(config: any, opts: NEncryptOpts, curPath: string[]): any {
    if (opts.paths?.include) {
        const shouldInclude = opts.paths.include(curPath);
        if (shouldInclude === true) {
            return encryptValue(config, opts);
        }
        if (shouldInclude === false) {
            return config;
        }
    }
    if (Array.isArray(config)) {
        return config.map((item, idx): any => 
            encryptConfigInner(item, opts, curPath.concat(`${idx}`)))
    }
    if (typeof config === "object") {
        return Object.fromEntries(
            Object.entries(config)
                .map(([key, val]) =>
                    [key, encryptConfigInner(val, opts, curPath.concat(key))]
                )
        )
    }
    return encryptValue(config, opts);
}

function parseConfig(config: string, opts?: DecryptOpts): any {
    switch (opts?.format) {
        case "yaml":
            return yaml.load(config, opts?.yaml?.loadOptions);
        case "json":
            return JSON.parse(config, opts?.json?.reviver)
    }
    throw new Error(`Unexpected format: ${opts?.format}`)
}

function serializeConfig(config: any, opts?: DecryptOpts): any {
    switch (opts?.format) {
        case "yaml":
            return yaml.dump(config, opts?.yaml?.dumpOptions);
        case "json":
            return JSON.stringify(config, opts?.json?.replacer)
    }
    throw new Error(`Unexpected format: ${opts?.format}`)
}

function inferFormat(filePath: string, opts?: DecryptOpts): ConfigFormat {
    if (opts?.format) return opts.format;
    if (filePath.match(/.ya?ml$/)) return "yaml";
    if (filePath.match(/.json/)) return "json";
    throw new Error(`Failed to infer config format from extension. Please pass format explicitly`);
}

async function getDecrypter(opts?: DecryptOpts) {
    const { Decrypter } = await (await import("age-encryption")).default()
    const decrypter = new Decrypter();
    if (opts?.identity) {
        decrypter.addIdentity(opts.identity)
    } else if (defaultIdentity) {
        decrypter.addIdentity(defaultIdentity)
    }
    return decrypter;
}

async function getEncrypter(opts?: EncryptOpts) {
    const { Encrypter, identityToRecipient } = await (await import("age-encryption")).default()
    const encrypter = new Encrypter();
    if (opts?.recipient) {
        encrypter.addRecipient(opts.recipient)
    } if (opts?.identity) {
        encrypter.addRecipient(identityToRecipient(opts.identity))
    } else if (defaultIdentity) {
        encrypter.addRecipient(identityToRecipient(defaultIdentity))
    }
    return encrypter;
}

export default {
    "files": [
      "test/**/*.test.ts"
    ],
    "typescript": {
      "rewritePaths": {
        "src/": "build/src/",
        "test/": "build/test/"
      },
      "compile": "tsc"
    },
    "serial": true
}

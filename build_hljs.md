# hljs build

```bash
git clone https://github.com/highlightjs/highlight.js.git
cd highlight.js
npm i
node tools/build.js -n c cpp java csharp ruby php python go delphi rust kotlin javascript
cp build/highlight.js ../fastEjudge/
cp src/styles/idea.css ../fastEjudge/
cd ...fastEjudge
npx terser highlight.js --ecma 2020 -c ecma=2020,passes=3,unsafe_arrows -m -o highlight.min.js
npx lightningcss idea.css --minify -o highlight.pack.idea.css

```


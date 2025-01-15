import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { babel } from '@rollup/plugin-babel';
import { terser } from 'rollup-plugin-terser';
import dts from 'rollup-plugin-dts';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';

const packageJson = require('./package.json');

const extensions = ['.js', '.jsx', '.ts', '.tsx'];

export default [
    // Main bundle
    {
        input: 'src/index.ts',
        output: [
            {
                file: packageJson.main,
                format: 'cjs',
                sourcemap: true
            },
            {
                file: packageJson.module,
                format: 'esm',
                sourcemap: true
            }
        ],
        plugins: [
            peerDepsExternal(),
            resolve({ extensions }),
            commonjs(),
            typescript({
                tsconfig: './tsconfig.json',
                declaration: true,
                declarationDir: 'dist',
                exclude: ['**/*.test.ts', '**/*.test.tsx']
            }),
            babel({
                extensions,
                babelHelpers: 'bundled',
                include: ['src/**/*'],
                exclude: 'node_modules/**'
            }),
            terser()
        ],
        external: [
            'react',
            'react-dom',
            '@shopify/app-bridge',
            '@shopify/app-bridge-react',
            '@shopify/polaris'
        ]
    },
    // Types bundle
    {
        input: 'dist/index.d.ts',
        output: [{ file: 'dist/index.d.ts', format: 'es' }],
        plugins: [dts()],
        external: [/\.css$/]
    }
];

// Development configuration
export const development = {
    input: 'src/index.ts',
    output: {
        file: 'dist/index.dev.js',
        format: 'esm',
        sourcemap: true
    },
    plugins: [
        peerDepsExternal(),
        resolve({ extensions }),
        commonjs(),
        typescript({
            tsconfig: './tsconfig.json',
            declaration: false
        }),
        babel({
            extensions,
            babelHelpers: 'bundled',
            include: ['src/**/*'],
            exclude: 'node_modules/**'
        })
    ],
    external: [
        'react',
        'react-dom',
        '@shopify/app-bridge',
        '@shopify/app-bridge-react',
        '@shopify/polaris'
    ]
};

// Production configuration with minification
export const production = {
    ...development,
    output: {
        file: 'dist/index.min.js',
        format: 'esm',
        sourcemap: true
    },
    plugins: [
        ...development.plugins,
        terser({
            compress: {
                pure_getters: true,
                unsafe: true,
                unsafe_comps: true
            }
        })
    ]
};

// UMD bundle for direct browser usage
export const umd = {
    input: 'src/index.ts',
    output: {
        file: 'dist/index.umd.js',
        format: 'umd',
        name: 'NimiPayShopify',
        globals: {
            react: 'React',
            'react-dom': 'ReactDOM',
            '@shopify/app-bridge': 'ShopifyAppBridge',
            '@shopify/app-bridge-react': 'ShopifyAppBridgeReact',
            '@shopify/polaris': 'ShopifyPolaris'
        }
    },
    plugins: [
        peerDepsExternal(),
        resolve({ extensions }),
        commonjs(),
        typescript({
            tsconfig: './tsconfig.json',
            declaration: false
        }),
        babel({
            extensions,
            babelHelpers: 'bundled',
            include: ['src/**/*'],
            exclude: 'node_modules/**'
        }),
        terser()
    ],
    external: [
        'react',
        'react-dom',
        '@shopify/app-bridge',
        '@shopify/app-bridge-react',
        '@shopify/polaris'
    ]
};

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    entry: './src/services/NimiqNodeService.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'nimiq-node.js',
        library: {
            name: 'NimiqNodeService',
            type: 'umd',
            export: 'default'
        }
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader'
                }
            }
        ]
    },
    resolve: {
        fallback: {
            "crypto": require.resolve("crypto-browserify"),
            "stream": require.resolve("stream-browserify"),
            "buffer": require.resolve("buffer/")
        }
    },
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist'),
        },
        compress: true,
        port: 9000,
        hot: true
    },
    // Enable source maps for debugging
    devtool: 'source-map',
    // Externalize @nimiq/core to be loaded from CDN
    externals: {
        '@nimiq/core': 'Nimiq'
    }
};

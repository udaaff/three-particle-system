import glsl from 'vite-plugin-glsl';

export default {
    base: './',
    server: {
        host: true,
        port: 8000
    },
    define: {
        APP_VERSION: JSON.stringify(process.env.npm_package_version),
    },
    plugins: [glsl()]
}
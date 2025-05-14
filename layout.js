export default function RootLayout({ children }) {
    return (
        <html lang="ru">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>Pixel Battle</title>
                <script src="obfuscator.js" defer></script>
            </head>
            <body>{children}</body>
        </html>
    )
}
  
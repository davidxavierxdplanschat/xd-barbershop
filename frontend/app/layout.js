import './globals.css';
export const metadata = {
  title: 'XD Barbershop — Seu estilo. Seu horário.',
  description:
    'Agende cortes e barba na XD Barbershop. Projeto público de portfólio desenvolvido por David Xavier.',
};
export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

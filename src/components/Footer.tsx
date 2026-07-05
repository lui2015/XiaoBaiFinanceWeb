import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-cream border-t-2 border-ink mt-12">
      <div className="mx-auto max-w-[1200px] px-4 py-6 text-sm text-ink/60 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="font-semibold">© {new Date().getFullYear()} 小白财经 · 仅供学习参考，不构成投资建议</div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/about" className="px-3 py-1 rounded-full font-semibold hover:bg-sunny hover:text-ink transition-colors">关于</Link>
          <Link href="/policy/terms" className="px-3 py-1 rounded-full font-semibold hover:bg-mint/30 hover:text-ink transition-colors">用户协议</Link>
          <Link href="/policy/privacy" className="px-3 py-1 rounded-full font-semibold hover:bg-sky/30 hover:text-ink transition-colors">隐私政策</Link>
          <Link href="/policy/disclaimer" className="px-3 py-1 rounded-full font-semibold hover:bg-coral/30 hover:text-ink transition-colors">免责声明</Link>
        </div>
      </div>
    </footer>
  );
}

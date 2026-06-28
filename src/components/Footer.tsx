export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-12">
      <div className="mx-auto max-w-[1200px] px-4 py-6 text-sm text-gray-500 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>© {new Date().getFullYear()} 小白财经 · 仅供学习参考，不构成投资建议</div>
        <div className="flex gap-4">
          <a href="/about" className="hover:text-brand-500">关于</a>
          <a href="/policy/terms" className="hover:text-brand-500">用户协议</a>
          <a href="/policy/privacy" className="hover:text-brand-500">隐私政策</a>
          <a href="/policy/disclaimer" className="hover:text-brand-500">免责声明</a>
        </div>
      </div>
    </footer>
  );
}

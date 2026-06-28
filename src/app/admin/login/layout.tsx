/** 登录页独立的 layout（不需要鉴权） */
export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-50">{children}</div>;
}

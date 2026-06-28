export default function PolicyPage({ params }: { params: { kind: string } }) {
  const map: Record<string, { title: string; body: string }> = {
    terms: {
      title: '用户服务协议',
      body: '欢迎使用小白财经服务。请在使用前仔细阅读本协议。注册或使用即表示你接受本协议的全部条款。一、账号 …… 二、内容 …… 三、责任 …… 四、变更与终止 ……',
    },
    privacy: {
      title: '隐私政策',
      body: '我们重视你的隐私。我们仅收集为提供服务所必需的最少信息（手机号或邮箱、昵称、头像）。手机号、邮箱以加密形式存储，并仅用于身份识别与必要通知。',
    },
    disclaimer: {
      title: '免责声明',
      body: '本站内容仅作学习与研究参考，不构成任何投资建议。投资有风险，决策需谨慎。本站对内容因任何原因导致的损失不承担责任。',
    },
  };
  const p = map[params.kind] || { title: '内容', body: '' };
  return (
    <div className="mx-auto max-w-[800px] px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">{p.title}</h1>
      <p className="text-gray-600 leading-7 whitespace-pre-line">{p.body}</p>
    </div>
  );
}

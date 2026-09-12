import React, { useState } from 'react'
import ENDINGS from '../content/endings.json' with { type: 'json' }
import { orderName } from '../game/format.js'

const PAGES = [
  {
    title: 'この教団が目指すもの',
    body: [
      '教義を定め、布教で信者を集め、事業を興し、宗教都市を広げ、最終的にこの国のかたちを書き換える。それがこのゲームの全体像。',
      '時間は日単位で進む。ヘッダーの「∥ ×1 ×2 ×4」で止めたり早めたりできる。迷ったら止めて考えればよい。',
      '右の「導きの書」が、次に何をすべきかを一手ずつ示してくれる。まずはその通りに進めるとよい。',
    ],
  },
  {
    title: '教祖はひとり、聖職者が要る',
    body: [
      '施設は建てただけでは動かない。<b>教祖を常駐させる</b>か、<b>規定数の聖職者を配置する</b>かのどちらかが要る。',
      '教祖はゲーム中ひとりしかいない。施設に入れている間は、教義改定・事業設立・教祖が要る布教が<b>すべて止まる</b>。',
      '<b>ここが最大の関門。</b>教育事業を興して神学校を建て、そこに教祖を入れて最初の聖職者を育てること。聖職者が増えるほど教祖は自由になり、同時に回せる施設が増える。聖職者のいない教団は、まず行き詰まる。',
    ],
  },
  {
    title: '二つのゲージに気をつける',
    body: [
      '<b>世間の警戒度</b>は、急拡大・終末思想・派手な施策で上がる。100に達すると強制捜査を受けて終わり。財団・慈恵病院・文化会館・奉仕活動などで下げられる。',
      '<b>闇度</b>は裏の事業に手を出すと濃くなる。金は桁違いに入るが、80を超えると教祖が暗殺される危険が現実になる。裏に触れないなら、このゲージは一生0のまま。',
      'どちらも「高いほど自然に鎮まる力」も働くので、どこかで釣り合う。その釣り合う場所を、自分で選ぶゲームだと思ってほしい。',
    ],
  },
  {
    title: '決着は四つある',
    body: [
      `<b>${ENDINGS.firstParty.title}</b>：${ENDINGS.firstParty.hint}`,
      `<b>${ENDINGS.congregation.title}</b>：${ENDINGS.congregation.hint}`,
      `<b>${ENDINGS.conglomerate.title}</b>：${ENDINGS.conglomerate.hint}`,
      `<b>${ENDINGS.uprising.title}</b>：${ENDINGS.uprising.hint}`,
      'どれかに到達しても、そこで終わりにせず経営を続けられる。敗北条件（資金枯渇・強制捜査・暗殺）は最後まで残る。',
    ],
  },
]

const KEY = 'cult-opening-seen'

export default function OpeningTutorial({ state, onClose }) {
  const [page, setPage] = useState(0)
  const p = PAGES[page]
  const last = page === PAGES.length - 1

  const finish = () => {
    try { localStorage.setItem(KEY, '1') } catch { /* 保存できなくても続行 */ }
    onClose()
  }

  return (
    <div className="modal-bg">
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="modal-head">
          {orderName(state)}・手引き
          <span className="faint" style={{ fontSize: 13, fontFamily: 'var(--gothic)', marginLeft: 'auto' }}>
            {page + 1} / {PAGES.length}
          </span>
        </div>
        <div className="modal-body" style={{ fontFamily: 'var(--gothic)' }}>
          <div className="mincho" style={{ fontSize: 19, color: 'var(--gold)', marginBottom: 12 }}>{p.title}</div>
          <ul className="tip-body" style={{ paddingLeft: 18 }}>
            {p.body.map((line, i) => (
              <li key={i} style={{ marginBottom: 9 }} dangerouslySetInnerHTML={{ __html: line }} />
            ))}
          </ul>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={finish}>とばす</button>
          {page > 0 && <button className="btn ghost" onClick={() => setPage(page - 1)}>戻る</button>}
          <button className="btn primary" onClick={() => (last ? finish() : setPage(page + 1))}>
            {last ? '始める' : '次へ'}
          </button>
        </div>
      </div>
    </div>
  )
}

export const openingSeen = () => {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

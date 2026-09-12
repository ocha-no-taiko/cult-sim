import React from 'react'
import { BUSINESSES, FACILITY_MAP } from '../game/data/facilities.js'
import { REGIONS } from '../game/data/regions.js'
import { isFacilityActive, convertCapacity, voteProjection } from '../game/engine/selectors.js'
import { BRANCH_MIN_FOLLOWERS } from '../game/engine/constants.js'
import { people, yen, facilityLabel } from '../game/format.js'

/** いま何をすべきかを1つだけ示す。手詰まりを防ぐための道しるべ。 */
function nextStep(state, t) {
  const has = (typeId) => state.facilities.some((f) => f.type === typeId)
  const running = (typeId) => state.facilities.some((f) => f.type === typeId && isFacilityActive(state, f))
  const idle = state.facilities.find((f) => !FACILITY_MAP[f.type].alwaysActive && !isFacilityActive(state, f))

  if (state.funds < 0) {
    return { t: '資金が尽きている', d: '布教施策を止めるか、施設を取り壊して立て直すこと。3日以内に黒字化できなければ教団は解散する。' }
  }
  if (idle) {
    const def = FACILITY_MAP[idle.type]
    return {
      t: `${facilityLabel(state, idle.type, def.name)}が止まっている`,
      d: `宗教都市の画面でこの施設を選び、教祖を置くか聖職者${def.priests}人を配置する。稼働していない施設は維持費だけを食う。`,
    }
  }
  if (!state.businesses.publishing) {
    return t.followers >= 400
      ? { t: '出版事業を興す', d: `事業タブから設立できる（${yen(BUSINESSES[0].cost)}）。教祖が自由でなければ設立できない。` }
      : { t: '信者を400人まで増やす', d: '布教タブの施策を回し、資金の許す範囲で布教所を建てる。出版事業の解禁が最初の節目。' }
  }
  if (!has('press')) {
    return {
      t: '出版局を建てる',
      d: `宗教都市に${state.names?.press || '出版局'}を建て、教祖か聖職者3人を置く。教団最初の安定収入になる。`,
    }
  }
  if (!state.businesses.education) {
    return t.followers >= 8_000
      ? { t: '教育事業を興す', d: '神学校が建てられるようになり、信者を聖職者へ転向させられる。' }
      : { t: `信者を${people(8_000)}まで増やす`, d: '教育事業が解禁されるまでは、施設を回せるのは教祖ひとりだけ。' }
  }
  if (!running('school')) {
    return {
      t: `${state.names?.school || '神学校'}を建てて教祖を入れる`,
      d: '最初の聖職者は教祖が自ら育てるしかない。聖職者が増えれば教祖は解放され、複数の施設を同時に回せる。',
    }
  }
  if (convertCapacity(state) > 0 && state.priests < 8) {
    return { t: '聖職者を増やす', d: '転向した分だけお布施は減る。どこまで実入りを削って手を増やすかの判断。' }
  }
  if (!REGIONS.some((r) => !state.regions[r.id].isHome && state.regions[r.id].unlocked)) {
    return t.followers >= BRANCH_MIN_FOLLOWERS
      ? { t: '他の地方に支部を開く', d: '得票率は展開した全地方の信者率の合算で決まる。拠点だけでは第一与党には届かない。' }
      : { t: `信者を${people(BRANCH_MIN_FOLLOWERS)}まで増やす`, d: '支部展開が解禁されると、他地方の人口にも手が届くようになる。' }
  }
  if (!state.businesses.foundation) {
    return t.followers >= 80_000
      ? { t: '財団を設立する', d: '警戒度が常時大きく下がる。急拡大の前に済ませておきたい。' }
      : { t: `信者を${people(80_000)}まで増やす`, d: '財団が解禁されるまでは、警戒度を上げすぎないよう施策を選ぶこと。' }
  }
  if (!running('foundationOffice')) {
    return { t: '財団事務局を稼働させる', d: '建てて聖職者6人を配置して初めて警戒度が下がる。' }
  }
  if (!state.businesses.party) {
    return t.followers >= 1_500_000
      ? { t: '政党を設立する', d: `設立から120日後に総選挙が行われる。それまでに得票率を積み上げる。` }
      : { t: `信者を${people(1_500_000)}まで増やす`, d: '未展開の地方を開き、信仰度を保ったまま規模を伸ばす。' }
  }
  const vp = voteProjection(state, t)
  const until = state.election.nextDay ? state.election.nextDay - state.day : 0
  return vp.wins
    ? { t: `総選挙まで${until}日`, d: '現状の見込みなら第一与党を取れる。信仰度と信者数を落とさないこと。' }
    : { t: `総選挙まで${until}日`, d: '得票率が第一党に届いていない。党本部・政界工作で得票係数を上げるか、信者をさらに増やす。' }
}

export default function GuidePanel({ state, totals: t }) {
  const step = nextStep(state, t)
  return (
    <div className="panel">
      <div className="panel-head">いま為すべきこと</div>
      <div className="panel-body" style={{ paddingTop: 11, paddingBottom: 12 }}>
        <div className="mincho" style={{ fontSize: 15.5, color: 'var(--gold)', marginBottom: 5 }}>{step.t}</div>
        <div className="faint" style={{ fontSize: 13, lineHeight: 1.85 }}>{step.d}</div>
      </div>
    </div>
  )
}

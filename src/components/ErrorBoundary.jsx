import React from 'react'

/**
 * 画面のどこかで例外が出ても、真っ暗にして操作不能にしない。
 * 対戦中は時間が止まらないので、せめて状況が読めて逃げ道がある状態にしておく。
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    console.error('画面の描画で例外が出た', error, info)
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children

    const detail = [
      error?.message ?? String(error),
      error?.stack?.split('\n').slice(0, 6).join('\n'),
      info?.componentStack?.split('\n').slice(0, 8).join('\n'),
    ].filter(Boolean).join('\n\n')

    return (
      <div className="screen" style={{ justifyContent: 'center' }}>
        <div className="screen-inner" style={{ maxWidth: 620 }}>
          <div className="panel">
            <div className="panel-head">不具合が起きた</div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="card-desc">
                画面の描画中に問題が起きて、この先を表示できなかった。
                進行中のセーブは残っているので、読み込み直せば続きから遊べる。
              </div>
              <pre className="crash-detail">{detail}</pre>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn primary" onClick={() => location.reload()}>読み込み直す</button>
                <button
                  className="btn"
                  onClick={() => navigator.clipboard?.writeText(detail)}
                  title="不具合の報告に使う"
                >
                  内容をコピー
                </button>
                <button
                  className="btn ghost"
                  onClick={() => { try { localStorage.removeItem('cult-save-v2') } catch { /* noop */ } location.reload() }}
                >
                  セーブを消して最初から
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

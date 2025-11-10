import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './MyTreesPage.css'

function MyTreesPage({ user }) {
  const [trees, setTrees] = useState([])
  const [treeType, setTreeType] = useState('PUBLIC')
  const [treeName, setTreeName] = useState('')
  const navigate = useNavigate()

  // ✅ 내 트리 목록 불러오기
  useEffect(() => {
    if (!user) return
    fetch(`http://localhost:3000/users/${user.id}/trees`)
      .then((res) => res.json())
      .then((data) => setTrees(data))
      .catch((err) => console.error(err))
  }, [user])

  // ✅ 트리 생성
  const handleCreateTree = async () => {
    if (!treeName.trim()) return alert('트리 이름을 입력하세요.')

    try {
      const res = await fetch('http://localhost:3000/trees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_id: user.id,
          tree_name: treeName,
          tree_type: treeType,
        }),
      })

      const newTree = await res.json()
      if (!res.ok) throw new Error(newTree.message || '트리 생성 실패')

      // ✅ 자동 참여 등록
      await fetch(`http://localhost:3000/trees/${newTree.tree_id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, tree_key: newTree.tree_key }),
      })

      // ✅ 생성 후 리스트 갱신
      setTrees((prev) => [...prev, newTree])
      setTreeName('')

      // ✅ 개인 트리의 경우 공유키 표시
      if (newTree.tree_type === 'PRIVATE') {
        const shareText = `🎄 개인 트리 초대 코드: ${newTree.tree_key}`
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(newTree.tree_key)
          alert(`${shareText}\n(코드가 클립보드에 복사되었습니다!)`)
        } else {
          alert(shareText)
        }
      } else {
        alert('공용 트리 생성 완료!')
      }
    } catch (err) {
      console.error(err)
      alert('트리 생성 중 오류가 발생했습니다.')
    }
  }

  if (!user) {
    return (
      <div className="my-trees-container">
        <div className="my-trees-panel">
          <h3>로그인 후 이용 가능합니다.</h3>
        </div>
      </div>
    )
  }

  return (
    <div className="my-trees-container">
      <h2 className="my-trees-title">{user.username}님의 트리 목록 🎄</h2>

      {/* ✅ 트리 생성 폼 */}
      <div className="my-trees-form">
        <input
          type="text"
          placeholder="트리 이름 입력"
          value={treeName}
          onChange={(e) => setTreeName(e.target.value)}
          className="my-trees-input"
        />
        <select
          value={treeType}
          onChange={(e) => setTreeType(e.target.value)}
          className="my-trees-select"
        >
          <option value="PUBLIC">공용 트리</option>
          <option value="PRIVATE">개인 트리</option>
        </select>
        <button onClick={handleCreateTree} className="my-trees-primary-btn">
          트리 생성
        </button>
      </div>

      {/* ✅ 트리 목록 표시 */}
      <ul className="my-trees-list">
        {trees.length === 0 && (
          <li className="my-trees-card my-trees-empty">
            아직 생성된 트리가 없습니다. 새로운 트리를 만들어보세요!
          </li>
        )}
        {trees.map((t) => (
          <li key={t.tree_id} className="my-trees-card">
            <strong className="tree-name">{t.tree_name}</strong>
            <div className="tree-meta">
              {t.tree_type === 'PUBLIC' ? '🌍 공용 트리' : '🔒 개인 트리'}
            </div>
            {t.tree_type === 'PRIVATE' && (
              <div className="tree-meta tree-meta--secondary">
                초대 코드: {t.tree_key}
              </div>
            )}
            <button
              onClick={() => navigate(`/tree/${t.tree_id}`)} // ✅ 트리 페이지로 이동
              className="my-trees-view-btn"
            >
              트리로 이동
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default MyTreesPage

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import Countdown from '../components/Countdown'
import treePageBg from '../assets/treePage-bg.gif'
import treeImage from '../assets/tree.png'
import noteImage from '../assets/note.png'
import './TreePage.css'

function TreePage({ user }) {
  const [notes, setNotes] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [clickPos, setClickPos] = useState({ x: 0, y: 0 })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const treeRef = useRef(null)
  const { id } = useParams()
  const treeId = id

  useEffect(() => {
    if (!treeId) return

    fetch(`http://localhost:3000/trees/${treeId}/notes`)
      .then((res) => {
        if (!res.ok) throw new Error('노트 불러오기 실패')
        return res.json()
      })
      .then((data) => {
        if (Array.isArray(data)) setNotes(data)
      })
      .catch((err) => console.error(err))
  }, [treeId])

  const handleTreeClick = (e) => {
    if (!user) {
      alert('로그인이 필요합니다!')
      window.location.href = '/login'
      return
    }

    if (!treeRef.current) return
    const rect = treeRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const treeCenterX = rect.width / 2
    const height = rect.height
    const baseWidth = rect.width
    const leftEdge = treeCenterX - (baseWidth / height) * y
    const rightEdge = treeCenterX + (baseWidth / height) * y

    if (x < leftEdge || x > rightEdge) return

    setClickPos({ x, y })
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!newNote.trim() || !user || !treeId) return

    try {
      setIsSubmitting(true)
      const res = await fetch(`http://localhost:3000/trees/${treeId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          message: newNote,
          pos_x: clickPos.x,
          pos_y: clickPos.y,
        }),
      })

      if (!res.ok) throw new Error('노트 저장 실패')
      const data = await res.json()
      const created = {
        note_id: data.note_id,
        message: newNote,
        pos_x: clickPos.x,
        pos_y: clickPos.y,
        author: user.username,
      }
      setNotes((prev) => [...prev, created])
      setShowModal(false)
      setNewNote('')
    } catch (error) {
      console.error(error)
      alert('노트 저장 중 문제가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="tree-page-bg"
      style={{
        backgroundImage: `url(${treePageBg})`,
      }}
    >
      <Countdown />
      <p className="tree-instruction">트리를 클릭하여 장식을 달아주세요</p>

      <div className="tree-page-wrapper">
        <div
          ref={treeRef}
          className="tree-canvas"
          style={{
            backgroundImage: `url(${treeImage})`,
          }}
          onClick={handleTreeClick}
        >
          {notes.map((note) => (
            <img
              key={note.note_id || `${note.pos_x}-${note.pos_y}`}
              src={noteImage}
              alt="tree note"
              className="tree-note"
              style={{
                position: 'absolute',
                top: (note.pos_y ?? note.y) - 28,
                left: (note.pos_x ?? note.x) - 24,
                width: '64px',
                height: '64px',
                pointerEvents: 'none',
              }}
            />
          ))}
        </div>
      </div>

      {showModal && (
        <div className="note-modal-overlay">
          <div className="note-modal">
            <h3>메모 작성</h3>
            <textarea
              className="note-textarea"
              rows={4}
              maxLength={120}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="트리에 남길 메시지를 입력하세요."
            />
            <div className="note-modal-actions">
              <button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? '저장 중...' : '작성'}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setShowModal(false)}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TreePage

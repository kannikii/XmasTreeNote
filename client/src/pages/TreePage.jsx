import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
  const [activeNote, setActiveNote] = useState(null)
  const [noteLikes, setNoteLikes] = useState({})
  const [noteComments, setNoteComments] = useState({})
  const [newComment, setNewComment] = useState('')
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false)
  const [likedNotes, setLikedNotes] = useState({})
  const [hasAccess, setHasAccess] = useState(false)
  const [isCheckingAccess, setIsCheckingAccess] = useState(true)
  const treeRef = useRef(null)
  const { id } = useParams()
  const treeId = id
  const navigate = useNavigate()

  useEffect(() => {
    if (!treeId) return
    if (!user) {
      setHasAccess(false)
      setIsCheckingAccess(false)
      alert('로그인이 필요합니다!')
      navigate('/login')
      return
    }

    setIsCheckingAccess(true)

    fetch(`http://localhost:3000/users/${user.id}/trees`)
      .then((res) => {
        if (!res.ok) throw new Error('트리 권한 확인 실패')
        return res.json()
      })
      .then((list) => {
        const allowed = Array.isArray(list)
          ? list.some((tree) => String(tree.tree_id) === String(treeId))
          : false

        if (!allowed) {
          alert('참여 중인 트리만 조회할 수 있습니다.')
          navigate('/', { replace: true })
        }
        setHasAccess(allowed)
      })
      .catch((err) => {
        console.error(err)
        alert('트리 접근 권한을 확인할 수 없습니다.')
        setHasAccess(false)
        navigate('/', { replace: true })
      })
      .finally(() => setIsCheckingAccess(false))
  }, [user, treeId, navigate])

  const loadComments = useCallback(async (noteId) => {
    if (!noteId) return
    try {
      const res = await fetch(`http://localhost:3000/notes/${noteId}/comments`)
      if (!res.ok) throw new Error('댓글 조회 실패')
      const data = await res.json()
      const comments = Array.isArray(data) ? data : []
      setNoteComments((prev) => ({ ...prev, [noteId]: comments }))
    } catch (error) {
      console.error(`노트 ${noteId} 댓글 조회 실패:`, error)
    }
  }, [])

  useEffect(() => {
    if (!treeId || !hasAccess) return

    const fetchNotes = async () => {
      try {
        const res = await fetch(`http://localhost:3000/trees/${treeId}/notes`)
        if (!res.ok) throw new Error('노트 불러오기 실패')
        const data = await res.json()

        if (!Array.isArray(data)) return
        setNotes(data)
        setLikedNotes({})

        const noteIds = data
          .map((note) => note?.note_id)
          .filter((noteId) => typeof noteId === 'number' || typeof noteId === 'string')

        if (noteIds.length === 0) {
          setNoteLikes({})
          return
        }

        const likeEntries = await Promise.all(
          noteIds.map(async (noteId) => {
            try {
              const countRes = await fetch(`http://localhost:3000/notes/${noteId}/likes/count`)
              if (!countRes.ok) throw new Error('좋아요 수 조회 실패')
              const countData = await countRes.json()
              return [noteId, countData.likeCount ?? 0]
            } catch (error) {
              console.error(`노트 ${noteId} 좋아요 수 조회 실패:`, error)
              return [noteId, 0]
            }
          })
        )

        setNoteLikes(Object.fromEntries(likeEntries))
      } catch (err) {
        console.error(err)
      }
    }

    fetchNotes()
  }, [treeId, hasAccess])

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
      setNoteLikes((prev) => ({ ...prev, [created.note_id]: 0 }))
      setLikedNotes((prev) => ({ ...prev, [created.note_id]: false }))
      setNoteComments((prev) => ({ ...prev, [created.note_id]: [] }))
      setShowModal(false)
      setNewNote('')
    } catch (error) {
      console.error(error)
      alert('노트 저장 중 문제가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleLike = async (noteId) => {
    if (!noteId) return
    if (!user) {
      alert('로그인이 필요합니다!')
      navigate('/login')
      return
    }

    const alreadyLiked = likedNotes[noteId] === true

    try {
      const res = await fetch(`http://localhost:3000/notes/${noteId}/likes`, {
        method: alreadyLiked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })

      if (!res.ok) throw new Error('좋아요 처리 실패')

      const data = await res.json()
      const latestCount =
        typeof data.likeCount === 'number'
          ? data.likeCount
          : noteLikes[noteId] || 0

      setNoteLikes((prev) => ({ ...prev, [noteId]: latestCount }))
      setLikedNotes((prev) => ({ ...prev, [noteId]: !alreadyLiked }))
    } catch (error) {
      console.error(error)
      alert('좋아요 처리 중 문제가 발생했습니다.')
    }
  }

  const handleSubmitComment = async () => {
    if (!user) {
      alert('로그인이 필요합니다!')
      navigate('/login')
      return
    }
    if (!activeNote?.note_id) return
    const noteId = activeNote.note_id
    const content = newComment.trim()
    if (!content) return

    try {
      setIsCommentSubmitting(true)
      const res = await fetch(`http://localhost:3000/notes/${noteId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, content }),
      })

      if (!res.ok) throw new Error('댓글 등록 실패')
      setNewComment('')
      await loadComments(noteId)
    } catch (error) {
      console.error(error)
      alert('댓글 등록 중 문제가 발생했습니다.')
    } finally {
      setIsCommentSubmitting(false)
    }
  }

  const activeNoteId = activeNote?.note_id
  const currentComments = activeNoteId ? noteComments[activeNoteId] : null
  useEffect(() => {
    if (!activeNoteId) return
    loadComments(activeNoteId)
  }, [activeNoteId, loadComments])

  if (isCheckingAccess) {
    return (
      <div
        className="tree-page-bg"
        style={{
          backgroundImage: `url(${treePageBg})`,
        }}
      >
        <Countdown />
        <p className="tree-instruction">트리 접근 권한을 확인 중입니다...</p>
      </div>
    )
  }

  if (!hasAccess) {
    return null
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
            <div
              key={note.note_id || `${note.pos_x}-${note.pos_y}`}
              className="tree-note-wrapper"
              style={{
                position: 'absolute',
                top: (note.pos_y ?? note.y) - 28,
                left: (note.pos_x ?? note.x) - 24,
              }}
              onClick={(e) => {
                e.stopPropagation()
                setActiveNote(note)
                setNewComment('')
              }}
            >
              <img
                src={noteImage}
                alt="tree note"
                className="tree-note"
                style={{
                  width: '64px',
                  height: '64px',
                }}
              />
              <span className="tree-note-like-count">
                ❤️ {noteLikes[note.note_id] ?? 0}
              </span>
            </div>
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

      {activeNote && (
        <div className="note-detail-overlay">
          <div className="note-detail-panel">
            <button className="note-detail-close" onClick={() => setActiveNote(null)}>
              ✖
            </button>
            <div className="note-detail-header">
              <h3>장식 메모</h3>
              <span className="note-detail-author">{activeNote.author || '익명'}</span>
            </div>
            <p className="note-detail-message">{activeNote.message}</p>

            <div className="note-detail-actions">
              <button
                className={`pixel-button note-like-toggle ${
                  likedNotes[activeNote.note_id] ? 'liked' : ''
                }`}
                onClick={() => handleToggleLike(activeNote.note_id)}
              >
                {likedNotes[activeNote.note_id] ? '💔 좋아요 취소' : '❤️ 좋아요'} (
                {noteLikes[activeNote.note_id] ?? 0})
              </button>
            </div>

            <div className="note-comment-section">
              <h4>댓글</h4>
              <div className="note-comment-list">
                {!Array.isArray(currentComments) && (
                  <p className="note-comment-empty">댓글을 불러오는 중입니다...</p>
                )}
                {Array.isArray(currentComments) && currentComments.length === 0 && (
                  <p className="note-comment-empty">첫 댓글을 남겨보세요!</p>
                )}
                {Array.isArray(currentComments) &&
                  currentComments.map((comment) => (
                    <div
                      key={comment.comment_id || `${comment.author}-${comment.content}`}
                      className="note-comment-item"
                    >
                      <span className="note-comment-author">{comment.author || '익명'}</span>
                      <p>{comment.content}</p>
                    </div>
                  ))}
              </div>
              <div className="note-comment-form">
                <input
                  type="text"
                  placeholder="댓글을 입력하세요"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <button
                  className="pixel-button"
                  type="button"
                  onClick={handleSubmitComment}
                  disabled={isCommentSubmitting}
                >
                  {isCommentSubmitting ? '등록 중...' : '댓글 등록'}
                </button>
              </div>
              <p className="note-comment-info">※ 댓글은 즉시 서버에 저장됩니다.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TreePage

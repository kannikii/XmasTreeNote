require('dotenv').config();
const cors = require('cors');
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('./config/db');

const app = express();
const port = process.env.PORT || 3000;

// JSON 요청 바디 파싱
app.use(express.json());

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true, // 세션, 쿠키 포함 요청 허용 (나중에 로그인 상태 유지 위해 필요)
}));

// ------------------------ 기본 라우트 ------------------------
app.get('/', (req, res) => {
  res.send('Christmas Tree API Server is ON!');
});

// ------------------------ 회원가입 ------------------------
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).send('모든 필드를 입력해야합니다.');
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = `
      INSERT INTO user (username, email, password, provider)
      VALUES (?, ?, ?, 'local')
    `;
    db.query(sql, [username, email, hashedPassword], (err, result) => {
      if (err) {
        console.error('DB 오류:', err);
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).send('이미 등록된 이메일입니다.');
        }
        return res.status(500).send('회원가입 실패');
      }
      res.status(201).send(`회원가입 성공! user_id = ${result.insertId}`);
    });
  } catch (error) {
    console.error('암호화 실패:', error);
    res.status(500).send('서버 내부 오류');
  }
});

// ------------------------ 로그인 ------------------------
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).send('이메일과 비밀번호를 모두 입력하세요.');
  }

  const sql = `
    SELECT * FROM user
    WHERE email = ? AND provider = 'local'
  `;
  db.query(sql, [email], async (err, results) => {
    if (err) return res.status(500).send('DB 조회 실패');
    if (results.length === 0) return res.status(401).send('등록되지 않은 이메일입니다.');

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).send('비밀번호가 올바르지 않습니다.');

    res.status(200).json({
      message: '로그인 성공',
      user: { id: user.user_id, username: user.username, email: user.email },
    });
  });
});

// 유저 삭제
app.delete("/users/:id", (req, res) => {
  const { id } = req.params
  const sql = "DELETE FROM user WHERE user_id = ?"
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("유저 삭제 실패:", err)
      return res.status(500).send("DB 오류")
    }
    if (result.affectedRows === 0)
      return res.status(404).send("존재하지 않는 사용자입니다.")
    res.status(200).send("계정 삭제 성공")
  })
})

// ------------------------ 트리 생성 ------------------------
app.post('/trees', (req, res) => {
  const { owner_id, tree_name, tree_type } = req.body;
  if (!owner_id || !tree_name) {
    return res.status(400).send('owner_id와 tree_name은 필수입니다.');
  }

  const type = tree_type && tree_type.toUpperCase() === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC';
  let treeKey = null;
  if (type === 'PRIVATE') {
    treeKey = Math.random().toString(36).substring(2, 14).toUpperCase();
  }

  const sql = `
    INSERT INTO tree (owner_id, tree_name, tree_type, tree_key)
    VALUES (?, ?, ?, ?)
  `;
  db.query(sql, [owner_id, tree_name, type, treeKey], (err, result) => {
    if (err) {
      console.error('트리 생성 오류:', err);
      return res.status(500).send('트리 생성 실패');
    }

    res.status(201).json({
      message: '트리 생성 성공',
      tree_id: result.insertId,
      tree_type: type,
      tree_key: treeKey
    });
  });
});

// ------------------------ 트리 조회 ------------------------
app.get('/users/:userID/trees', (req, res) => {
  const { userID } = req.params;

  const sql = `
    SELECT 
      t.tree_id, 
      t.tree_name, 
      t.tree_type, 
      t.tree_key,
      t.created_at,
      mt.joined_at
    FROM member_tree AS mt
    JOIN tree AS t ON mt.tree_id = t.tree_id
    WHERE mt.user_id = ?
    ORDER BY mt.joined_at DESC
  `;

  db.query(sql, [userID], (err, result) => {
    if (err) {
      console.error('❌ 내 트리 조회 실패:', err);
      return res.status(500).send('내 트리 조회 실패');
    }
    res.status(200).json(result);
  });
});
// 트리 키로 트리 조회
app.get('/tree/by-key/:key', (req, res) => {
  const { key } = req.params
  const sql = 'SELECT * FROM tree WHERE tree_key = ?'
  db.query(sql, [key], (err, result) => {
    if (err) return res.status(500).send({ message: 'DB 오류' })
    if (result.length === 0) return res.status(404).send({ message: '트리를 찾을 수 없습니다.' })
    res.status(200).json(result[0])
  })
})


// ------------------------ 트리 참여 ------------------------
app.post('/trees/:treeID/join', (req, res) => {
  const { treeID } = req.params;
  const { user_id, tree_key } = req.body;

  if (!user_id) {
    return res.status(400).send('user_id는 필수입니다.');
  }

  const checkTreeSql = 'SELECT tree_type, tree_key FROM tree WHERE tree_id = ?';
  db.query(checkTreeSql, [treeID], (err, result) => {
    if (err) {
      console.error('트리 조회 실패:', err);
      return res.status(500).send('DB 조회 실패');
    }
    if (result.length === 0) {
      return res.status(404).send('존재하지 않는 트리입니다.');
    }

    const tree = result[0];
    if (tree.tree_type === 'PRIVATE' && tree_key !== tree.tree_key) {
      return res.status(403).send('트리 키가 올바르지 않습니다.');
    }

    const insertSql = 'INSERT IGNORE INTO member_tree (user_id, tree_id) VALUES (?, ?)';
    db.query(insertSql, [user_id, treeID], (err2, result2) => {
      if (err2) {
        console.error('참여 실패:', err2);
        return res.status(500).send('참여 실패');
      }
      if (result2.affectedRows === 0) {
        return res.status(200).send('이미 트리에 참여 중입니다.');
      }
      res.status(201).send('트리 참가 성공!');
    });
  });
});

// ------------------------ 노트 작성 ------------------------
app.post('/trees/:treeID/notes', (req, res) => {
  const { treeID } = req.params;
  const { user_id, message, pos_x, pos_y } = req.body;

  if (!user_id || !message) {
    return res.status(400).send('user_id와 message는 필수입니다.');
  }

  const sql = `
    INSERT INTO note (tree_id, user_id, message, pos_x, pos_y)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.query(sql, [treeID, user_id, message, pos_x || 0, pos_y || 0], (err, result) => {
    if (err) {
      console.error('메모 등록 실패:', err);
      return res.status(500).send('메모 등록 실패');
    }
    res.status(200).json({
      message: '메모 등록 성공',
      note_id: result.insertId
    });
  });
});

// ------------------------ 노트 조회 ------------------------
app.get('/trees/:treeID/notes', (req, res) => {
  const { treeID } = req.params;
  const sql = `
    SELECT n.note_id, n.message, n.pos_x, n.pos_y, n.created_at,
           u.user_id, u.username AS author
    FROM note n
    JOIN user u ON n.user_id = u.user_id
    WHERE n.tree_id = ?
    ORDER BY n.created_at DESC
  `;
  db.query(sql, [treeID], (err, result) => {
    if (err) {
      console.error('메모 조회 실패:', err);
      return res.status(500).send('메모 조회 실패');
    }
    res.status(200).json(result);
  });
});

// ------------------------ 댓글 작성 ------------------------
app.post('/notes/:noteID/comments', (req, res) => {
  const { noteID } = req.params;
  const { user_id, content } = req.body;

  if (!user_id || !content) {
    return res.status(401).send('userId와 content는 필수 입니다.');
  }
  const sql = `
    insert into comment (note_id,user_id,content)
    values (?,?,?);
  `;
  db.query(sql, [noteID, user_id, content], (err, result) => {
    if (err) {
      console.error('댓글 등록 실패:', err);
      return res.status(500).send('댓글 작성 실패');
    }
    res.status(201).json({
      message: '댓글 등록 성공',
      comment_id: result.insertId,
    });
  });
});

// ------------------------ 댓글 조회 ------------------------
app.get('/notes/:noteID/comments', (req, res) => {
  const { noteID } = req.params;
  const sql = `
    SELECT 
      c.comment_id,
      c.content,
      c.created_at,
      u.user_id,
      u.username AS author
    FROM comment c
    JOIN user u ON c.user_id = u.user_id
    WHERE c.note_id = ?
    ORDER BY c.created_at ASC
  `;
  db.query(sql, [noteID], (err, result) => {
    if (err) {
      console.error('댓글 조회 실패:', err);
      return res.status(500).send('댓글 조회 실패');
    }
    res.status(200).json(result);
  });
});
// 댓글 수정
// ------------------------ 댓글 삭제 ------------------------

// ------------------------ 좋아요 추가 ------------------------
app.post('/notes/:noteID/likes', (req, res) => {
  const { noteID } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).send('userid는 필수입니다.');
  }
  const insertSql = `
    INSERT IGNORE INTO like_note (note_id,user_id)
    VALUES (?,?)
  `;

  db.query(insertSql, [noteID, user_id], (err, result) => {
    if (err) {
      console.error('좋아요 등록 실패:', err);
      return res.status(500).send('좋아요 등록 실패');
    }
    const countSql = `
      SELECT COUNT(*) AS likeCount
      FROM like_note
      WHERE note_id = ?
    `;
    db.query(countSql, [noteID], (err2, rows) => {
      if (err2) {
        console.error('좋아요 수 조회 실패:', err2);
        return res.status(500).send('좋아요 수 조회 실패');
      }
      const likeCount = rows[0].likeCount;
      const liked = result.affectedRows > 0; // true면 이번에 새로 좋아요 성공

      res.status(200).json({
        message: liked ? '좋아요 추가' : '이미 좋아요를 누른 상태입니다.',
        liked,
        likeCount,
      });
    });
  });
});

// ------------------------ 좋아요 취소 ------------------------
app.delete('/notes/:noteID/likes', (req, res) => {
  const { noteID } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).send('userid는 필수 입니다.');
  }
  const deleteSql = `
    DELETE FROM like_note
    WHERE note_id = ? AND user_id = ?
  `;
  db.query(deleteSql, [noteID, user_id], (err, result) => {
    if (err) {
      console.error('좋아요 취소 실패:', err);
      return res.status(500).send('좋아요 취소 실패');
    }
    // 다시 좋아요 수 조회
    const countSql = `
      SELECT COUNT(*) AS likeCount
      FROM like_note
      WHERE note_id = ?
    `;
    db.query(countSql, [noteID], (err2, rows) => {
      if (err2) {
        console.error('좋아요 수 조회 실패:', err2);
        return res.status(500).send('좋아요 수 조회 실패');
      }
      const likeCount = rows[0].likeCount;

      res.status(200).json({
        message: '좋아요 취소',
        likeCount,
      });
    });
  });
});

// ------------------------ 좋아요 수만 조회 ------------------------
app.get('/notes/:noteID/likes/count', (req, res) => {
  const { noteID } = req.params;

  const sql = `
    SELECT COUNT(*) AS likeCount
    FROM like_note
    WHERE note_id = ?
  `;
  db.query(sql, [noteID], (err, rows) => {
    if (err) {
      console.error('좋아요 수 조회 실패:', err);
      return res.status(500).send('좋아요 수 조회 실패');
    }
    res.status(200).json({ likeCount: rows[0].likeCount });
  });
});

// ------------------------ 서버 시작 ------------------------
app.listen(port, () => {
  console.log(`API Server running on http://localhost:${port}`);
});

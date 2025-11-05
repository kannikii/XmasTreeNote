const express = require('express');
const app = express();
const port = 3000; //서버 포트
const db = require('./config/db');
const bcrypt = require('bcrypt');

//JSON 요청 본문 파싱용 middleware
app.use(express.json());

// 기본 라우트 (메인 페이지)
app.get('/', (req, res) => {
    res.send('Christmas Tree is ON!');
});

// // 사용자 전체 조회 (READ)
// app.get('/users',(req,res) =>{
//     const sql = 'select * from users';
//     db.query(sql,(err,results) =>{
//         if(err) {
//             console.error('조회 오류: ',err);
//             return res.status(500).send('db조회실패');
//         }
//         res.json(results);
//     });
// });

//회원가입
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).send('모든 필드를 입력해야합니다.');
    }
    //비밀번호 암호화 bcrypt 라이브러리 이용
    try {
        const hashedPassword = await bcrypt.hash(password, 10); //10회 salt
        const sql = 'insert into user (username, email, password) values (?,?,?)';
        db.query(sql, [username, email, hashedPassword], (err, result) => {
            if (err) {
                console.error('DB 오류: ', err);
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).send('이미 등록된 이메일 입니다.');
                }
                return res.status(500).send('회원가입실패');
            }
            res.status(201).send(`회원가입 성공! user_id = ${result.insertId}`);
        });
    } catch (error) {
        console.error('암호화실패:', error);
        res.status(500).send('서버 내부 오류');
    }
});

//로그인
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    //입력값 확인
    if (!email || !password) {
        return res.status(400).send('이메일과 비밀번호를 모두 입력하세요.');
    }

    const sql = 'SELECT * FROM user WHERE email = ? ';
    db.query(sql, [email], async (err, results) => {
        if (err) return res.status(500).send('DB조회 실패');
        if (results.length === 0) return res.status(401).send('등록되지않은 이메일입니다.');
        const user = results[0];

        //비밀번호 확인
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).send('비밀번호가 올바르지 않습니다.');

        res.status(200).json({
            message: '로그인 성공',
            user: { id: user.user_id, username: user.username, email: user.email },
        });
    });
});

// 트리 생성 라우터
app.post('/trees', (req, res) => {
    const { owner_id, tree_name, tree_type } = req.body;
    if (!owner_id || !tree_name) {
        return res.status(400).send('owner_id와 tree_name은 필수 입니다.');
    }
    // public / private 타입 확인
    const type = tree_type && tree_type.toUpperCase() === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC';

    // private인 경우 tree_key 자동 생성
    let treeKey = null;
    if (type === 'PRIVATE') {
        treeKey = Math.random().toString(36).substring(2, 14).toUpperCase(); //12자리 난수 키
    }
    // 트리 데이터 삽입
    const sql = 'insert into tree (owner_id,tree_name,tree_type,tree_key) values (?,?,?,?)';
    db.query(sql, [owner_id, tree_name, type, treeKey], (err, result) => {
        if (err) {
            console.error('트리 생성 오류', err);
            return res.status(500).send('트리 생성 실패');
        }
        //트리 정보 반환
        res.status(201).json({
            message: '트리 생성성공',
            tree_id: result.insertId,
            tree_type: type,
            tree_key: treeKey
        });
    });
});

//트리 참여
app.post('/trees/:treeID/join', (req, res) => {
    const { treeID } = req.params;
    const { user_id, tree_key } = req.body;

    if (!user_id) {
        return res.status(400).send('user_id는 필수 입니다.');
    }

    //트리 정보 확인
    const checkTreeSql = 'select tree_type, tree_key from tree where tree_id = ?';
    db.query(checkTreeSql, [treeID], (err, result) => {
        if (err) {
            console.error('트리 조회 실패 ', err);
            return res.status(500).send('db조회실패');
        }
        if (result.length === 0) {
            return res.status(404).send('존재하지 않는 트리입니다. ');
        }
        const tree = result[0];

        //PRIVATE 트리인 경우 키 확인
        if (tree.tree_type === 'PRIVATE') {
            if (!tree_key || tree_key !== tree.tree_key) {
                console.log('요청 키:', tree_key);
                console.log('DB 키:', tree.tree_key);
                return res.status(403).send('트리 키가 올바르지 않습니다.');
            }
        }

        //참여 정보 삽입 (중복 방지)
        const insertSql = 'insert ignore into member_tree (user_id, tree_id) values (?,?)';
        db.query(insertSql, [user_id, treeID], (err2, result2) => {
            if (err2) {
                console.error('참여 실패', err2);
                return res.status(500).send('참여 실패');
            }

            if (result2.affectedRows === 0) {
                return res.status(200).send('이미트리에 참여중입니다.');
            }
            res.status(201).send(' 트리 참가 성공 ! ');
        });
    });
});
// 트리에 노트 달기
app.post('/trees/:treeID/notes', (req, res) => {
    const { treeID } = req.params;
    const { user_id, message, pos_x, pos_y } = req.body;

    // 입력 검증
    if (!user_id || !message) {
        return res.status(400).send('user_id와 message는 필수입니다.');
    }

    const sql = `
        insert into note (tree_id,user_id,message,pos_x,pos_y)
        values (?,?,?,?,?)
    `;
    const params = [treeID, user_id, message, pos_x || 0, pos_y || 0];

    db.query(sql, params, (err, result) => {
        if (err) {
            console.error('MEMO 등록 실패', err);
            return res.status(500).send('메모 등록 실패');
        }
        return res.status(200).json({
            message: '메모 등록 성공',
            note_id: result.insertId
        });
    });
});

// 트리 노트 조회
app.get('/trees/:treeID/notes', (req, res) => {
    const { treeID } = req.params;
    const sql = `
        select n.note_id, n.message, n.pos_x, n.pos_y, n.created_at, u.user_id, u.username as author
        from note n
        join user u on n.user_id = u.user_id
        where n.tree_id = ?
        order by n.created_at desc
    `;

    db.query(sql,[treeID],(err,result)=>{
        if(err) {
            console.error('메모 조회 실패:',err);
            return res.status(500).send('메모 조회 실패');
        }
        return res.status(200).json(result);
    });
});


//start server
app.listen(port, () => {
    console.log(`localhost:${port} run.`);
});


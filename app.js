const express = require('express');
const app = express();
const port = 3000; //서버 포트
const db = require('./config/db');
const bcrypt = require('bcrypt');

//JSON 요청 본문 파싱용 middleware
app.use(express.json());

// 기본 라우트 (메인 페이지)
app.get('/',(req,res)=>{
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
app.post('/register',async(req,res) => {
    const {username, email,password } =req.body;

    if(!username || !email || !password) {
        return res.status(400).send('모든 필드를 입력해야합니다.');
    }
    //비밀번호 암호화 bcrypt 라이브러리 이용
    try{
        const hashedPassword = await bcrypt.hash(password,10); //10회 salt
        const sql = 'insert into user (username, email, password) values (?,?,?)';
        db.query(sql, [username, email, hashedPassword], (err,result)=> {
            if(err) {
                console.error('DB 오류: ' , err);
                if(err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).send('이미 등록된 이메일 입니다.');
                }
                return res.status(500).send('회원가입실패');
            }
            res.status(201).send(`회원가입 성공! user_id = ${result.insertId}`);
        });
    }catch (error) {
        console.error('암호화실패:',error);
        res.status(500).send('서버 내부 오류');
    }
});

//로그인
app.post('/login',(req,res)=>{
    const {email,password} = req.body;
    //입력값 확인
    if(!email || !password) {
        return res.status(400).send('이메일과 비밀번호를 모두 입력하세요.');
    }

    const sql = 'SELECT * FROM user WHERE email = ? ';
    db.query(sql,[email],async(err,results)=>{
        if(err) return res.status(500).send('DB조회 실패');
        if(results.length===0) return res.status(401).send('등록되지않은 이메일입니다.');
        const user = results[0];

        //비밀번호 확인
        const match = await bcrypt.compare(password,user.password);
        if(!match) return res.status(401).send('비밀번호가 올바르지 않습니다.');

        res.status(200).json({
            message: '로그인 성공',
            user: { id: user.user_id, username: user.username, email: user.email},
        });
    });
});

//start server
app.listen(port,()=> {
    console.log(`localhost:${port} run.`);
});


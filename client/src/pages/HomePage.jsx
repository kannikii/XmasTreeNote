import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Countdown from "../components/Countdown";
import PixelButton from "../components/PixelButton";

export default function HomePage({ user }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState(null);
  const [privateKey, setPrivateKey] = useState("");

  const handleJoin = async () => {
    if (!user) {
      alert("로그인 후 이용 가능합니다.");
      navigate("/login");
      return;
    }

    if (mode === "PUBLIC") {
      const res = await fetch(`http://localhost:3000/users/${user.id}/trees`);
      const trees = await res.json();
      const publicTree = trees.find((t) => t.tree_type === "PUBLIC");
      if (publicTree) navigate(`/tree/${publicTree.tree_id}`);
      else alert("참여 중인 공개 트리가 없습니다.");
    } else if (mode === "PRIVATE") {
      if (!privateKey.trim()) return alert("트리 키를 입력하세요.");
      try {
        const res = await fetch(`http://localhost:3000/tree/by-key/${privateKey}`);
        const tree = await res.json();
        if (!res.ok) throw new Error(tree.message);
        await fetch(`http://localhost:3000/trees/${tree.tree_id}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id, tree_key: privateKey }),
        });
        navigate(`/tree/${tree.tree_id}`);
      } catch (err) {
        alert("유효하지 않은 트리 키입니다.");
      }
    }
  };

  return (
    <div className="main-content">
      <Countdown />
      <h2 className="main-title">🎁 Merry Christmas World 🎁</h2>
      <p className="subtitle">트리와 함께 추억을 남겨보세요.</p>

      <div style={{ marginTop: "40px", display: "flex", gap: "20px" }}>
        <PixelButton
          text="트리 생성"
          onClick={() => (user ? navigate("/mytrees") : (alert("로그인이 필요합니다."), navigate("/login")))}
        />
        <PixelButton
          text="트리 참가"
          onClick={() => (user ? setMode(mode === null ? "SELECT" : null) : (alert("로그인이 필요합니다."), navigate("/login")))}
        />
      </div>

      {mode === "SELECT" && (
        <div style={{ marginTop: "20px" }}>
          <PixelButton text="🌍 공개 트리" onClick={() => setMode("PUBLIC")} />
          <PixelButton text="🔒 개인 트리" onClick={() => setMode("PRIVATE")} />
        </div>
      )}

      {mode === "PRIVATE" && (
        <div style={{ marginTop: "20px" }}>
          <input
            type="text"
            placeholder="트리 키를 입력하세요"
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            style={{ padding: "8px", fontFamily: "Press Start 2P" }}
          />
          <PixelButton text="참가하기" onClick={handleJoin} />
        </div>
      )}

      {mode === "PUBLIC" && (
        <div style={{ marginTop: "20px" }}>
          <PixelButton text="공개 트리로 이동" onClick={handleJoin} />
        </div>
      )}
    </div>
  );
}

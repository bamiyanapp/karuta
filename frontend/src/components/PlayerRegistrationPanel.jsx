function PlayerRegistrationPanel({
  showPlayerRegistration,
  setShowPlayerRegistration,
  players,
  removePlayer,
  newPlayerName,
  setNewPlayerName,
  addPlayer,
  maxPlayers,
}) {
  let toggleButtonLabel = "取った人を記録する";
  if (showPlayerRegistration) toggleButtonLabel = "参加者登録を閉じる";
  else if (players.length > 0) toggleButtonLabel = "参加者を編集する";

  return (
    <div>
      <button
        type="button"
        onClick={() => setShowPlayerRegistration(prev => !prev)}
        className="btn btn-sm btn-outline-secondary rounded-pill px-3"
      >
        {toggleButtonLabel}
      </button>
      {showPlayerRegistration && (
        <div className="mt-3 mx-auto text-start" style={{ maxWidth: "360px" }}>
          {players.length > 0 && (
            <div className="d-flex flex-wrap gap-2 mb-2">
              {players.map(name => (
                <span key={name} className="badge bg-secondary d-flex align-items-center gap-1 py-2 px-3 fs-6">
                  {name}
                  <button
                    type="button"
                    onClick={() => removePlayer(name)}
                    className="btn-close btn-close-white"
                    style={{ fontSize: "0.6rem" }}
                    aria-label={`${name}を削除`}
                  ></button>
                </span>
              ))}
            </div>
          )}
          {players.length < maxPlayers && (
            <div className="d-flex gap-2">
              <input
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPlayer(); } }}
                placeholder="名前を入力"
                className="form-control"
                maxLength={20}
              />
              <button type="button" onClick={addPlayer} disabled={!newPlayerName.trim()} className="btn btn-outline-primary">追加</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PlayerRegistrationPanel;

#!/bin/bash
# ramen_sumo_prpto.html をブラウザで開くローカルサーバースクリプト（空きポート自動選択）

# デフォルトポート
BASE_PORT=8000
PORT=$BASE_PORT

# 空きポートを探す
while lsof -i :$PORT >/dev/null 2>&1; do
    PORT=$((PORT+1))
done

# サーバーをバックグラウンドで起動
python3 -m http.server $PORT &
PID=$!

# ブラウザで開く
if [[ $1 == "2" ]]; then
    open http://localhost:$PORT/ramen_sumo_prpto.html
elif [[ $1 == "3" ]]; then
    open http://localhost:$PORT/third_person_ramen_sumo.html
else
    echo "args error: valid command is 2 or 3"
    echo "STOP"
    kill $PID
    exit    
fi

echo "ローカルサーバーを起動しました (PID: $PID) ポート: $PORT"
echo "停止するには: kill $PID"

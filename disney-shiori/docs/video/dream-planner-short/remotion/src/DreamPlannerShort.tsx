import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const scenes = [
  {
    title: "ショーの予定、\nかんたんに決めたい？",
    body: "時間を見ながら1日の予定を作れます",
  },
  {
    title: "まずは日付を選ぶ",
    body: "ホームのカレンダーから行く日をタップ",
  },
  {
    title: "見たいショーを選択",
    body: "詳細ボタンで内容や場所も確認",
  },
  {
    title: "自動 or 手動で作成",
    body: "自動なら候補をまとめて作成",
  },
  {
    title: "時間の重なりを確認",
    body: "空き時間には食事や休憩を追加",
  },
  {
    title: "完成したら画像保存",
    body: "LINE共有や当日の確認に便利",
  },
];

const purple = "#6C5CE7";
const ink = "#233042";

export const DreamPlannerShort: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const sceneLength = durationInFrames / scenes.length;
  const sceneIndex = Math.min(scenes.length - 1, Math.floor(frame / sceneLength));
  const local = frame - sceneIndex * sceneLength;
  const scene = scenes[sceneIndex];
  const enter = interpolate(local, [0, 0.25 * fps], [60, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const opacity = interpolate(local, [0, 0.25 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #fcf8ff 0%, #e8f5ff 100%)",
        fontFamily: "Hiragino Sans, system-ui, sans-serif",
        color: ink,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: 300,
          right: -180,
          top: -150,
          background: "rgba(75,190,232,0.22)",
        }}
      />
      <div style={{ position: "absolute", left: 70, top: 58, background: "#fff", borderRadius: 28, padding: "12px 26px", color: purple, fontWeight: 900, fontSize: 28 }}>
        夢のしおり
      </div>
      <div style={{ transform: `translateY(${enter}px)`, opacity, padding: "180px 82px 0" }}>
        <h1 style={{ whiteSpace: "pre-line", fontSize: 68, lineHeight: 1.15, margin: 0, fontWeight: 900 }}>
          {scene.title}
        </h1>
        <p style={{ fontSize: 34, lineHeight: 1.45, marginTop: 30, color: "#5C697B", fontWeight: 800 }}>
          {scene.body}
        </p>
      </div>
      <div style={{ position: "absolute", left: 220, top: 560, width: 640, height: 930, borderRadius: 56, background: "#fff", boxShadow: "0 22px 55px rgba(80,65,150,0.20)", transform: `translateY(${enter * 0.7}px)`, opacity }}>
        <div style={{ margin: 34, height: 862, borderRadius: 42, background: "#FAF8FF", border: "2px solid #D9D2FF", padding: 38 }}>
          <div style={{ color: purple, fontSize: 28, fontWeight: 900, marginBottom: 34 }}>Dream Schedule Planner</div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ height: 116, borderRadius: 26, background: "#fff", border: "2px solid #D9D2FF", marginBottom: 24, padding: "22px 26px", fontSize: 26, fontWeight: 900 }}>
              {sceneIndex < 2 ? ["日付を選ぶ", "パークを選ぶ", "見たいショーを選ぶ", "自動 or 手動"][i] : ["ショー選択", "時間選択", "予定調整", "画像保存"][i]}
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", left: 70, bottom: 90, width: 940, height: 20, borderRadius: 10, background: "#E1DAFA" }}>
        <div style={{ height: 20, borderRadius: 10, background: purple, width: `${((frame + 1) / durationInFrames) * 100}%` }} />
      </div>
    </AbsoluteFill>
  );
};


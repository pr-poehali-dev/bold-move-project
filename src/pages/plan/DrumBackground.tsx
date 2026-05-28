export default function DrumBackground() {
  return (
    <div style={{
      position: "absolute",
      top: "50%",
      right: -210,
      transform: "translateY(-50%)",
      width: 420,
      height: 420,
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(14,10,30,0.82) 0%, rgba(14,10,30,0.45) 50%, transparent 75%)",
      pointerEvents: "none",
      zIndex: 0,
    }} />
  );
}

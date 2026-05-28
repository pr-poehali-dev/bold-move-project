interface Props {
  onShowList: () => void;
}

export default function DrumViewToggle({ onShowList }: Props) {
  return (
    <div style={{
      pointerEvents: "all",
      display: "flex",
      justifyContent: "flex-end",
      padding: "0 6px 10px 0",
    }}>
      <div style={{
        display: "flex",
        background: "rgba(14,10,30,0.85)",
        border: "1px solid rgba(124,58,237,0.3)",
        borderRadius: 20,
        padding: 3,
        gap: 2,
      }}>
        <button
          style={{
            padding: "4px 10px",
            borderRadius: 16,
            border: "none",
            background: "rgba(124,58,237,0.5)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            cursor: "default",
            display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="2.5" r="1.5" fill="currentColor"/>
            <circle cx="6" cy="6" r="1.5" fill="currentColor"/>
            <circle cx="6" cy="9.5" r="1.5" fill="currentColor"/>
          </svg>
          Барабан
        </button>
        <button
          onClick={onShowList}
          style={{
            padding: "4px 10px",
            borderRadius: 16,
            border: "none",
            background: "transparent",
            color: "rgba(255,255,255,0.5)",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
            transition: "all 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="1" width="10" height="2" rx="1" fill="currentColor"/>
            <rect x="1" y="5" width="10" height="2" rx="1" fill="currentColor"/>
            <rect x="1" y="9" width="10" height="2" rx="1" fill="currentColor"/>
          </svg>
          Список
        </button>
      </div>
    </div>
  );
}

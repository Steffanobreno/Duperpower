// Drawn in code so there is no image asset to manage: a white "W" with a paw dot on brand blue.
export function AppIcon({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1d6fb8",
        color: "#ffffff",
        fontSize: size * 0.62,
        fontWeight: 800,
        fontFamily: "sans-serif",
        borderRadius: size * 0.22,
      }}
    >
      W
    </div>
  );
}

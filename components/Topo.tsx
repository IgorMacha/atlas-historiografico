import Link from "next/link";
export default function Topo({ children }: { children?: React.ReactNode }) {
  return (
    <header className="topo">
      <Link className="marca" href="/"><b>Atlas Historiográfico</b><span>Estudo de História · ABNT</span></Link>
      <div className="esp" />
      {children}
      <form action="/auth/sair" method="post"><button className="btn sm" type="submit">Sair</button></form>
    </header>
  );
}

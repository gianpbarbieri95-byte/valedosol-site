import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container-site flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-display text-6xl text-gold">404</p>
      <h1 className="mt-6 max-w-xl text-balance text-3xl leading-tight md:text-[2.5rem]">
        Esta página não existe mais.
      </h1>
      <p className="mt-4 max-w-md text-pretty leading-relaxed text-ink-soft">
        O imóvel pode ter sido vendido, alugado ou saído do site. Mas temos outros — e talvez o
        certo esteja entre eles.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/imoveis">Ver imóveis disponíveis</ButtonLink>
        <ButtonLink href="/contato" variant="outline">
          Falar com a Vale do Sol
        </ButtonLink>
      </div>
    </div>
  );
}

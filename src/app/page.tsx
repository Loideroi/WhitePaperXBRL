import { FileUp, CheckCircle, Download, Shield } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center px-4">
          <h1 className="text-xl font-bold">WhitePaper XBRL</h1>
          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            MiCA Compliant
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Transform Whitepapers to
          <span className="text-primary"> iXBRL</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Convert your crypto-asset whitepapers into ESMA-compliant iXBRL format. Simple upload,
          automatic extraction, full validation.
        </p>

        {/* Upload Area */}
        <div className="mx-auto mt-12 max-w-xl">
          <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 bg-card p-12 transition-colors hover:border-primary/50">
            <FileUp className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">Drop your PDF here</p>
            <p className="mt-1 text-sm text-muted-foreground">or click to browse</p>
            <p className="mt-4 text-xs text-muted-foreground">
              Supports PDF whitepapers up to 50MB
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid gap-8 md:grid-cols-3">
          <FeatureCard
            icon={<FileUp className="h-8 w-8" />}
            title="Smart Extraction"
            description="Automatically extract and map fields from your PDF whitepaper to XBRL taxonomy elements"
          />
          <FeatureCard
            icon={<CheckCircle className="h-8 w-8" />}
            title="Full Validation"
            description="Validate against 480+ ESMA assertions before generating your submission-ready file"
          />
          <FeatureCard
            icon={<Download className="h-8 w-8" />}
            title="Instant Download"
            description="Download your iXBRL file ready for submission to your National Competent Authority"
          />
        </div>
      </section>

      {/* Supported Token Types */}
      <section className="container mx-auto px-4 py-16">
        <h3 className="text-center text-2xl font-bold">Supported Token Types</h3>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <TokenTypeCard
            type="OTHR"
            title="Other Crypto-Assets"
            description="Utility tokens, fan tokens, and other crypto-assets not classified as ART or EMT"
          />
          <TokenTypeCard
            type="ART"
            title="Asset-Referenced Tokens"
            description="Tokens backed by a basket of assets maintaining stable value"
          />
          <TokenTypeCard
            type="EMT"
            title="E-Money Tokens"
            description="Stablecoins representing fiat currency value"
          />
        </div>
      </section>

      {/* Compliance Badge */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-green-500/10 px-4 py-2 text-green-600">
          <Shield className="h-5 w-5" />
          <span className="text-sm font-medium">ESMA MiCA Taxonomy 2025-03-31 Compliant</span>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-background py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>WhitePaper XBRL - MiCA Whitepaper Transformation Tool</p>
          <p className="mt-1">
            Compliant with Commission Implementing Regulation (EU) 2024/2984
          </p>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center text-primary">{icon}</div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function TokenTypeCard({
  type,
  title,
  description,
}: {
  type: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <span className="inline-block rounded bg-primary/10 px-2 py-1 text-sm font-mono font-semibold text-primary">
        {type}
      </span>
      <h4 className="mt-3 font-semibold">{title}</h4>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

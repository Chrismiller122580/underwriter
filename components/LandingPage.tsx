'use client';

import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

function scrollToInfo() {
  document.getElementById('learn-more')?.scrollIntoView({ behavior: 'smooth' });
}

export function LandingPage() {
  return (
    <div className="landing">
      <div className="landing-theme-toggle">
        <ThemeToggle className="theme-toggle-on-dark" />
      </div>
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <p className="landing-eyebrow">Freedom Warranty · Claims Intelligence</p>
          <h1 className="landing-title">
            Faster, smarter warranty claim intake and review
          </h1>
          <p className="landing-lead">
            FWCUT helps claimants submit complete requests online and gives your
            underwriting team AI-assisted tools to review risk, coverage, and
            documentation — without replacing adjuster judgment.
          </p>

          <div className="landing-cta-row">
            <Link href="/submit" className="button landing-cta-primary">
              Submit a Claim
            </Link>
            <Link href="/login" className="button landing-cta-login">
              Staff Login
            </Link>
            <button
              type="button"
              className="button button-secondary landing-cta-info"
              onClick={scrollToInfo}
            >
              Get Info
            </button>
          </div>

          <ul className="landing-trust-list">
            <li>Secure staff access</li>
            <li>Policy-based contract identification</li>
            <li>AI-assisted underwriting review</li>
          </ul>
        </div>
      </section>

      <section id="learn-more" className="landing-section">
        <div className="landing-section-inner">
          <h2>What FWCUT does</h2>
          <p className="landing-section-lead">
            A browser-based platform for Freedom Warranty claim submission and
            adjuster review. Built for speed at intake and consistency at
            decision time.
          </p>

          <div className="landing-audience-grid">
            <article className="landing-audience-card">
              <p className="landing-card-label">For claimants</p>
              <h3>Submit online in minutes</h3>
              <ul>
                <li>Enter your policy number to identify your plan type</li>
                <li>Use screenshot autofill to speed up data entry</li>
                <li>Attach supporting files when you have them — none required upfront</li>
                <li>Receive clear next steps if more information is needed</li>
              </ul>
              <Link href="/submit" className="landing-inline-link">
                Start a claim →
              </Link>
            </article>

            <article className="landing-audience-card landing-audience-card-staff">
              <p className="landing-card-label">For adjusters &amp; supervisors</p>
              <h3>Review with AI support</h3>
              <ul>
                <li>Central dashboard for all submitted claims</li>
                <li>AI risk scoring and recommendation support on every review</li>
                <li>Contract-aware checks aligned to plan type</li>
                <li>Flags for missing information and guideline concerns</li>
              </ul>
              <Link href="/login" className="landing-inline-link">
                Staff login →
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-muted">
        <div className="landing-section-inner">
          <h2>How it works</h2>
          <div className="landing-steps">
            <div className="landing-step">
              <span className="landing-step-num">1</span>
              <h3>Intake</h3>
              <p>
                Claimants complete a guided form with vehicle, incident, and repair
                details. Policy number drives contract context automatically.
              </p>
            </div>
            <div className="landing-step">
              <span className="landing-step-num">2</span>
              <h3>AI analysis</h3>
              <p>
                Each claim is analyzed for risk, coverage fit, and documentation
                gaps. The system highlights what to request — not auto-approve
                without review.
              </p>
            </div>
            <div className="landing-step">
              <span className="landing-step-num">3</span>
              <h3>Adjuster decision</h3>
              <p>
                Your team runs underwriting, reviews AI insights, and makes the
                final approve, deny, or hold decision.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <h2>Built for your workflow</h2>
          <div className="feature-grid">
            <div className="feature-card">
              <h3>Smart intake</h3>
              <p>
                Structured capture for policy, vehicle, claimant, incident, and
                repair information with validation along the way.
              </p>
            </div>
            <div className="feature-card">
              <h3>Flexible documents</h3>
              <p>
                Supporting files are optional at submission. AI underwriting can
                request specific records later when guidelines require them.
              </p>
            </div>
            <div className="feature-card">
              <h3>Decision support</h3>
              <p>
                Risk scores, summaries, and review flags help adjusters move
                faster while keeping humans in control of outcomes.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-footer-cta">
        <div className="landing-section-inner landing-footer-cta-inner">
          <h2>Ready to get started?</h2>
          <p>Submit a claim online or sign in to the claims dashboard.</p>
          <div className="landing-cta-row landing-cta-row-center">
            <Link href="/submit" className="button">
              Submit a Claim
            </Link>
            <Link href="/login" className="button button-secondary">
              Staff Login
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
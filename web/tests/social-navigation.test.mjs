import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const socialLinks = await readFile(new URL('../src/components/social-links.tsx', import.meta.url), 'utf8');
const siteNavigation = await readFile(new URL('../src/components/site-navigation.tsx', import.meta.url), 'utf8');
const siteShell = await readFile(new URL('../src/components/site-shell.tsx', import.meta.url), 'utf8');
const homePage = await readFile(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
const globalStyles = await readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const homeStyles = await readFile(new URL('../src/app/search-page.module.css', import.meta.url), 'utf8');

test('shared social links preserve exact destinations and accessible new-tab names', () => {
  assert.match(socialLinks, /https:\/\/www\.facebook\.com\/parcelsavvy/);
  assert.match(socialLinks, /https:\/\/www\.instagram\.com\/parcelsavvy\//);
  assert.match(socialLinks, /rel="noopener noreferrer"/);
  assert.match(socialLinks, /aria-label=\{`\$\{name\} \(opens in a new tab\)`\}/);
});

test('desktop headers use icon-only links while mobile navigation keeps labels', () => {
  assert.match(siteShell, /<SiteNavigation \/>/);
  assert.match(homePage, /<SiteNavigation home \/>/);
  assert.match(siteNavigation, /<div className="site-navigation-desktop">[\s\S]*<SocialLinks as="div" variant="icon-only" className="site-header-social-links" \/>/);
  assert.match(siteNavigation, /<details className="site-navigation-mobile">[\s\S]*<summary onKeyDown=\{toggleMobileMenu\}>Menu<\/summary>[\s\S]*<SocialLinks as="div" className="site-navigation-social-links" \/>/);
  assert.match(siteNavigation, /event\.key !== 'Enter' && event\.key !== ' '/);
  assert.match(globalStyles, /\.site-header-social-links \{ display: none; \}/);
  assert.match(homeStyles, /@media \(max-width: 1240px\) \{[\s\S]*\.headerInner[\s\S]*flex-wrap: wrap;[\s\S]*\.county[\s\S]*order: 3;/);
});

test('both footer placements and print exclusions remain intact', () => {
  assert.match(siteShell, /site-footer-social-heading[\s\S]*<SocialLinks \/>/);
  assert.match(homePage, /footerSocialHeading[\s\S]*<SocialLinks className=\{styles\.footerSocialLinks\} \/>/);
  assert.match(globalStyles, /@media print \{[\s\S]*\.social-links,[\s\S]*\.site-footer-social-heading[\s\S]*display: none !important;/);
});

// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'ZJP blog',
  tagline: '时常记录 时常回顾',
  favicon: 'img/logo.png',

  // Set the production url of your site here
  url: 'https://zjp7071.cn',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'mo-xiaoxiu', // Usually your GitHub org/user name.
  projectName: 'zjp_website', // Usually your repo name.

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  
  markdown: {
    mermaid: true,
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
		docs: {
          //sidebarPath: './sidebars.js',
		  sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          //editUrl:
           //'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.

          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],
  
  themes: [
    [
      "@easyops-cn/docusaurus-search-local",
      /** @type {import("@easyops-cn/docusaurus-search-local").PluginOptions} */
      ({
        hashed: true,
        language: ["en", "zh"],
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
      }),
    ],
    "@docusaurus/theme-mermaid"
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/logo.png',
      navbar: {
        title: 'ZJP blog',
        logo: {
          alt: 'ZJP Logo',
          src: 'img/logo.png',
        },
        items: [
		  {to: '/blog', label: '主页', position: 'left'},
		  {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: '编程博客',
          },
		  {
            type: 'docSidebar',
            sidebarId: 'calligraphySidebar',
            position: 'left',
            label: '书法',
          },
          {
            href: 'https://github.com/mo-xiaoxiu',
            //label: 'GitHub',
            position: 'right',
			className: 'header-github-link',
            'aria-label': 'GitHub repository',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: '网站',
            items: [
              {label: '首页', to: '/'},
              {label: '博客主页', to: '/blog/info'},
              {label: '编程文档', to: '/docs/coding/AI和大模型应用开发/AI几个基本概念与联系'},
              {label: '书法专题', to: '/docs/calligraphy/雨后天晴'},
            ],
          },
          {
            title: '技术',
            items: [
              {label: 'Linux', to: '/docs/coding/Linux探索和记录/Linux函数调用栈打印方案'},
              {label: 'C++', to: '/docs/coding/C++探索和记录/C++Singleton对象模型探索'},
              {label: 'AI', to: '/docs/coding/AI和大模型应用开发/lesson 1 快速开始'},
            ],
          },
          {
            title: '联系',
            items: [
              {label: 'GitHub', href: 'https://github.com/mo-xiaoxiu'},
            ],
          },
        ],
        copyright: `© ${new Date().getFullYear()} ZJP. All rights reserved.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;

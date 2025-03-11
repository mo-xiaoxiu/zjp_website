import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: '编程记录',
    Svg: require('@site/static/img/codeNote.svg').default,
    description: (
      <>
		Linux、C/C++等编程记录
      </>
    ),
  },
  {
    title: '个人思考',
    Svg: require('@site/static/img/ownerThink.svg').default,
    description: (
      <>
		小随笔
      </>
    ),
  },
  {
    title: '书法小记',
    Svg: require('@site/static/img/calligraphic.svg').default,
    description: (
      <>
		书法的小作和欣赏
      </>
    ),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

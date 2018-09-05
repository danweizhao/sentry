const COUNT_OBJ = tag => {
  let tagObject;

  if (tag === 'user') {
    const user = TestStubs.User();
    tagObject = {
      _health_id: `${tag}:${user.id}`,
      value: user,
    };
  } else if (tag === 'release') {
    const release = TestStubs.Release();
    tagObject = {
      _health_id: `${tag}:${release.slug}`,
      value: release,
    };
  } else {
    tagObject = {
      _health_id: `${tag}:${tag}-slug`,
      value: tag,
    };
  }

  return {
    count: 123,
    [tag]: tagObject,
  };
};

export function Top(tag = 'release', params) {
  const countObject = COUNT_OBJ(tag);
  return {
    data: [countObject],
    totals: {
      count: 123,
      lastCount: 43,
    },
  };
}

export function Graph(tag = 'release', params) {
  const countObject = COUNT_OBJ(tag);

  return {
    data: [
      [new Date(), [{...countObject, count: 321}, {...countObject, count: 79}]],
      [new Date(), [countObject]],
    ],
  };
}

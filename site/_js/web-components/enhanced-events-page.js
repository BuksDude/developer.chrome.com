/*
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview A component responsible for handling orchestration on the
 * events page.
 */
import {BaseElement} from './base-element';
import {EnhancedSelect} from './enhanced-select';
import {loadMore} from '../misc/load-more';
import memoize from '../utils/memoize';

const getEvents = memoize(async () => {
  const response = await fetch('/events.json');

  //todo - handle
  if (response.status !== 200) {
    throw new Error('Unable to fetch /events.json');
  }

  const all = await response.json();

  return {
    upcomingEvents: all.filter(event => !event.isPastEvent),
    pastEvents: all.filter(event => event.isPastEvent),
  };
});

export class EnhancedEventsPage extends BaseElement {
  constructor() {
    super();

    this.selectedFilters = {
      topics: [],
      location: [],
      googler: [],
    };

    this.filterElements = this.getFilterElements();
    //todo - hook the mobile filters up too
    this.mobileElements = this.getMobileElements();
    this.loadMoreUpcoming = null;
    this.loadMorePast = null;
  }

  async connectedCallback() {
    super.connectedCallback();
    this.mobileElements.handleConnect();
    this.filterElements.handleConnect();

    this.loadMoreUpcoming = await this.initLoadMore('UPCOMING');
    this.loadMorePast = await this.initLoadMore('PAST');
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.mobileElements.handleDisconnect();
    this.filterElements.handleDisconnect();
  }

  /**
   * @returns {{handleConnect: function, handleDisconnect: function, opener: Element, filters: Element}}
   */
  getMobileElements() {
    const filters = this.querySelector('#mobile-filters');
    const opener = this.querySelector('#mobile-filters-opener');

    if (opener === null) {
      throw new Error('Element missing: #mobile-filters-opener');
    }

    if (filters === null) {
      throw new Error('Element missing: #mobile-filters');
    }

    const handleOpen = () => {
      // @ts-ignore
      filters.showModal();
    };

    const closeOnBackdropClick = e => {
      // @ts-ignore
      if (e.target.tagName === 'DIALOG') filters.close();
    };

    return {
      filters,
      opener,
      handleConnect: () => {
        opener.addEventListener('click', handleOpen);
        filters.addEventListener('click', closeOnBackdropClick);
      },
      handleDisconnect: () => {
        opener.removeEventListener('click', handleOpen);
        filters.removeEventListener('click', closeOnBackdropClick);
      },
    };
  }

  /**
   * @returns {{handleConnect: function, handleDisconnect: function, filters: NodeListOf<Element>}}
   */
  getFilterElements() {
    const filters = this.querySelectorAll('.events-filter');

    const clickHandler = async e => {
      const t = e.target;

      if (!(t instanceof EnhancedSelect)) {
        return;
      }

      this.currentOffset = 0;

      //todo - update the ui showing list of selected filters.
      this.selectedFilters = {
        ...this.selectedFilters,
        ...{[t.name]: t.value},
      };

      //todo - loading gifs/icons. Error handling/notice
      //todo - if a card is open this closes it.
      //todo - show/hide button
      this.loadMoreUpcoming?.restart();
      this.loadMorePast?.restart();
    };

    return {
      filters,
      handleConnect: () => {
        filters.forEach(ele => {
          ele.addEventListener('change', clickHandler);
        });
      },
      handleDisconnect: () => {
        filters.forEach(ele => {
          ele.removeEventListener('change', clickHandler);
        });
      },
    };
  }

  /**
   * @param {{location:array, topics:array, googlers:array}[]} events
   * @returns {*}
   */
  filterEvents(events) {
    return events.filter(event => {
      if (
        this.selectedFilters.location.length &&
        this.selectedFilters.location[0] !== event.location
      ) {
        return false;
      }

      if (
        this.selectedFilters.topics.length &&
        this.selectedFilters.topics.some(topic =>
          event.topics.includes(topic)
        ) === false
      ) {
        return false;
      }

      if (
        this.selectedFilters.googler.length &&
        event.googlers.includes(this.selectedFilters.googler[0]) === false
      ) {
        return false;
      }

      return true;
    });
  }

  /**
   * @param{('UPCOMING'|'PAST')} group
   * @returns {Promise<{currentOffset, total, take, restart}|null>}
   */
  async initLoadMore(group) {
    const button = this.querySelector(
      group === 'UPCOMING' ? '#load-upcoming-events' : '#load-past-events'
    );

    const container = this.querySelector(
      group === 'UPCOMING' ? '#upcoming-events' : '#past-events'
    );

    if (!container) return null;

    return loadMore(
      button,
      container,
      async (skip, take) => {
        const groups = await getEvents();
        const events =
          group === 'UPCOMING'
            ? this.filterEvents(groups.upcomingEvents)
            : this.filterEvents(groups.pastEvents);

        return {
          updated_total: events.length,
          items: events.slice(skip, take + skip).map(event => event.html),
        };
      },
      () => {
        document
          .getElementById('loading-error')
          ?.classList.remove('display-none');
      },
      {
        skip: container.querySelectorAll('enhanced-event-card').length ?? 0,
        take: 10,
      }
    );
  }
}

customElements.define('enhanced-events-page', EnhancedEventsPage);